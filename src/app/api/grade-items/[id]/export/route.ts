import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gradeItemId = params.id;

    // 獲取上傳的檔案
    const formData = await request.formData();
    const file = formData.get('template') as File;

    if (!file) {
      return NextResponse.json(
        { error: '請上傳範本檔案' },
        { status: 400 }
      );
    }

    // 讀取範本檔案
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // 獲取第一個工作表
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 轉換為 JSON 格式以便處理
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length === 0) {
      return NextResponse.json(
        { error: '範本檔案是空的' },
        { status: 400 }
      );
    }

    // 找到標題行（掃描前 10 行）
    let headerRowIndex = -1;
    let headers: string[] = [];
    let studentIdColumnIndex = -1;

    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      // 嘗試找到學號欄位（更精確的匹配，避免誤判）
      const colIndex = row.findIndex((header) => {
        const headerStr = String(header || '').trim();
        // 精確匹配常見的學號欄位名稱
        return /^(學號|studentid|student\s*id|student\s*no|studentno|stu\s*no|no)$/i.test(headerStr) ||
               // 或者欄位名稱以這些關鍵字開頭
               /^(學號|student\s*no|student\s*id|studentid)/i.test(headerStr);
      });

      if (colIndex !== -1) {
        headerRowIndex = i;
        headers = row.map(h => String(h || '').trim());
        studentIdColumnIndex = colIndex;
        break;
      }
    }

    if (studentIdColumnIndex === -1 || headerRowIndex === -1) {
      return NextResponse.json(
        {
          error: '無法在範本中找到學號欄位',
          detail: '請確保範本中有「學號」、「Student NO」或「StudentID」欄位',
          foundRows: data.slice(0, 5)
        },
        { status: 400 }
      );
    }

    // 獲取成績項目和所有相關成績
    const gradeItem = await prisma.gradeItem.findUnique({
      where: { id: gradeItemId },
      include: {
        course: true,
        grades: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!gradeItem) {
      return NextResponse.json(
        { error: '找不到該成績項目' },
        { status: 404 }
      );
    }

    // 建立學號到成績的映射
    const gradeMap = new Map<string, number>();
    gradeItem.grades.forEach((grade) => {
      gradeMap.set(grade.student.studentId, grade.score);
    });

    // 找到或創建成績欄位（在標題行中查找）
    let scoreColumnIndex = headers.findIndex((header) =>
      /成績|score|分數|grade/i.test(String(header).trim())
    );

    // 如果找到了 "Score" 欄位，就使用它；否則添加新欄位
    if (scoreColumnIndex === -1) {
      scoreColumnIndex = headers.length;
      headers.push(`${gradeItem.name}`);
      // 更新標題行
      data[headerRowIndex] = headers;
    }

    // 填入成績（從標題行的下一行開始）
    let updatedCount = 0;
    let notFoundStudents: string[] = [];

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      const studentId = String(row[studentIdColumnIndex] || '').trim();

      // 跳過可能的重複標題行（檢查是否包含常見的標題關鍵字）
      const isHeaderRow = /^(學號|student\s*no|student\s*id|studentid|姓名|name|chinese\s*name)$/i.test(studentId);
      if (isHeaderRow) continue;

      if (studentId && gradeMap.has(studentId)) {
        // 確保行有足夠的長度
        while (row.length <= scoreColumnIndex) {
          row.push('');
        }
        row[scoreColumnIndex] = gradeMap.get(studentId);
        updatedCount++;
      } else if (studentId) {
        // 記錄找不到成績的學號
        notFoundStudents.push(studentId);
      }
    }

    // 轉換回工作表
    const newWorksheet = XLSX.utils.aoa_to_sheet(data);

    // 創建新的工作簿
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);

    // 生成 Excel 檔案
    const excelBuffer = XLSX.write(newWorkbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    // 生成檔案名稱
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${gradeItem.course.name}_${gradeItem.name}_成績_${timestamp}.xlsx`;

    // 返回檔案
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'X-Updated-Count': String(updatedCount),
        'X-Not-Found-Count': String(notFoundStudents.length),
        // 使用 Base64 編碼來傳遞可能包含中文的學號
        'X-Not-Found-Students': notFoundStudents.length > 0
          ? Buffer.from(notFoundStudents.join(',')).toString('base64')
          : '',
      },
    });
  } catch (error) {
    console.error('導出 Excel 錯誤:', error);
    return NextResponse.json(
      {
        error: '導出失敗',
        detail: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

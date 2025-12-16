const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 讀取Excel檔案
function readExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('Excel檔案讀取成功');
    console.log('總行數:', jsonData.length);
    
    return jsonData;
  } catch (error) {
    console.error('讀取Excel檔案失敗:', error);
    return null;
  }
}

// 解析學生資料 - 修復版
function parseStudentData(rawData) {
  if (!rawData || rawData.length === 0) return [];
  
  // 找到標題行
  let headerRowIndex = 0;
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row.some(cell => 
      typeof cell === 'string' && 
      (cell.includes('學號') || cell.includes('姓名') || cell.includes('座號'))
    )) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headers = rawData[headerRowIndex];
  console.log('找到標題行:', headers);
  
  // 找出學號和姓名的欄位索引
  let studentIdIndex = -1;
  let nameIndex = -1;
  let emailIndex = -1;
  
  headers.forEach((header, index) => {
    if (typeof header === 'string') {
      const headerStr = header.toLowerCase();
      if (headerStr.includes('學號') || headerStr.includes('student') || headerStr.includes('id')) {
        studentIdIndex = index;
      }
      if (headerStr.includes('姓名') || headerStr.includes('name')) {
        nameIndex = index;
      }
      if (headerStr.includes('email') || headerStr.includes('mail')) {
        emailIndex = index;
      }
    }
  });
  
  console.log('欄位索引 - 學號:', studentIdIndex, '姓名:', nameIndex, 'Email:', emailIndex);
  
  // 解析學生資料 - 排除標題行
  const students = [];
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    
    // 跳過空行
    if (!row || row.every(cell => !cell)) continue;
    
    const studentId = row[studentIdIndex]?.toString().trim();
    const name = row[nameIndex]?.toString().trim();
    const email = emailIndex >= 0 ? row[emailIndex]?.toString().trim() : '';
    
    // 排除標題行內容 - 如果學號欄位是「學號」就跳過
    if (studentId === '學號' || name === '姓名') continue;
    
    if (studentId && name) {
      students.push({
        studentId,
        name,
        email: email || null,
        class: 'A' // A班
      });
    }
  }
  
  console.log('解析完成，找到', students.length, '位學生');
  console.log('前3位學生資料:', students.slice(0, 3));
  
  return students;
}

// 確保互動投影課程存在
async function ensureInteractiveCourse() {
  try {
    let course = await prisma.course.findUnique({
      where: { name: '互動投影' }
    });
    
    if (!course) {
      course = await prisma.course.create({
        data: {
          name: '互動投影',
          code: 'IC335',
          description: '互動投影課程 - A班'
        }
      });
      console.log('創建新課程:', course);
    } else {
      console.log('找到現有課程:', course);
    }
    
    return course;
  } catch (error) {
    console.error('課程處理失敗:', error);
    throw error;
  }
}

// 匯入學生到資料庫
async function importStudents(students, courseId) {
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const student of students) {
    try {
      // 檢查學生是否已存在於同一課程中（不是全域檢查）
      const existingStudent = await prisma.student.findFirst({
        where: { 
          studentId: student.studentId,
          courseId: courseId  // 只檢查同一課程
        }
      });
      
      if (existingStudent) {
        console.log(`學生 ${student.studentId} ${student.name} 已存在於此課程，跳過`);
        skipCount++;
        continue;
      }
      
      // 創建新學生
      await prisma.student.create({
        data: {
          studentId: student.studentId,
          name: student.name,
          email: student.email,
          class: student.class,
          courseId: courseId
        }
      });
      
      console.log(`成功匯入: ${student.studentId} ${student.name}`);
      successCount++;
      
    } catch (error) {
      console.error(`匯入失敗 ${student.studentId} ${student.name}:`, error.message);
      errorCount++;
    }
  }
  
  return { successCount, skipCount, errorCount };
}

// 主程式
async function main() {
  const excelFilePath = '/Users/eric/Downloads/1141_IC416_A (1).xls';
  
  try {
    console.log('=== 開始匯入互動投影A班學生 ===');
    console.log('Excel檔案路徑:', excelFilePath);
    
    // 1. 讀取Excel檔案
    const rawData = readExcelFile(excelFilePath);
    if (!rawData) {
      throw new Error('無法讀取Excel檔案');
    }
    
    // 2. 解析學生資料
    const students = parseStudentData(rawData);
    if (students.length === 0) {
      throw new Error('沒有找到有效的學生資料');
    }
    
    // 3. 確保課程存在
    const course = await ensureInteractiveCourse();
    
    // 4. 匯入學生
    console.log('\n=== 開始匯入資料庫 ===');
    const result = await importStudents(students, course.id);
    
    // 5. 總結報告
    console.log('\n=== 匯入完成 ===');
    console.log(`課程: ${course.name} (ID: ${course.id})`);
    console.log(`成功匯入: ${result.successCount} 位學生`);
    console.log(`已存在跳過: ${result.skipCount} 位學生`);
    console.log(`匯入失敗: ${result.errorCount} 位學生`);
    console.log(`總計處理: ${result.successCount + result.skipCount + result.errorCount} 位學生`);
    
  } catch (error) {
    console.error('匯入過程發生錯誤:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { readExcelFile, parseStudentData, ensureInteractiveCourse, importStudents };
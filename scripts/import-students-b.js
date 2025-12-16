const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 讀取B班Excel檔案
function readBClassExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('B班Excel檔案讀取成功');
    console.log('總行數:', jsonData.length);
    console.log('前5行資料:');
    console.log(jsonData.slice(0, 5));
    
    return jsonData;
  } catch (error) {
    console.error('讀取B班Excel檔案失敗:', error);
    return null;
  }
}

// 解析B班學生資料
function parseBClassStudentData(rawData) {
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
  
  // 解析學生資料
  const students = [];
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    
    // 跳過空行
    if (!row || row.every(cell => !cell)) continue;
    
    const studentId = row[studentIdIndex]?.toString().trim();
    const name = row[nameIndex]?.toString().trim();
    const email = emailIndex >= 0 ? row[emailIndex]?.toString().trim() : '';
    
    if (studentId && name) {
      students.push({
        studentId,
        name,
        email: email || null,
        class: 'B' // B班
      });
    }
  }
  
  console.log('解析完成，找到', students.length, '位B班學生');
  console.log('前3位學生資料:', students.slice(0, 3));
  
  return students;
}

// 主程式
async function main() {
  const excelFilePath = '/Users/eric/Downloads/1141_IC335_B.xls';
  
  console.log('開始讀取B班Excel檔案:', excelFilePath);
  const rawData = readBClassExcel(excelFilePath);
  
  if (!rawData) {
    console.error('無法讀取B班Excel檔案');
    return;
  }
  
  const students = parseBClassStudentData(rawData);
  
  if (students.length === 0) {
    console.error('沒有找到有效的B班學生資料');
    return;
  }
  
  // 將解析結果保存為JSON檔案
  const outputPath = path.join(__dirname, '../temp-students-b.json');
  fs.writeFileSync(outputPath, JSON.stringify(students, null, 2), 'utf8');
  console.log('B班學生資料已保存到:', outputPath);
  
  return students;
}

if (require.main === module) {
  main();
}

module.exports = { readBClassExcel, parseBClassStudentData };
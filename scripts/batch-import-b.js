const fs = require('fs');
const path = require('path');

// 讀取B班學生資料並清理
function cleanBClassStudentData() {
  const dataPath = path.join(__dirname, '../temp-students-b.json');
  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // 移除標題行（第一筆資料）並過濾有效資料
  const cleanData = rawData.filter((student, index) => {
    // 跳過第一行（標題行）
    if (index === 0) return false;
    
    // 確保學號和姓名都存在且不為空
    return student.studentId && 
           student.name && 
           student.studentId !== '學號' && 
           student.name !== '姓名';
  });
  
  console.log('B班清理前資料筆數:', rawData.length);
  console.log('B班清理後資料筆數:', cleanData.length);
  console.log('前3筆清理後的B班資料:');
  console.log(cleanData.slice(0, 3));
  
  return cleanData;
}

// 批量插入B班學生到資料庫
async function batchInsertBClass(students) {
  const API_BASE = 'http://localhost:3000';
  
  console.log(`開始批量匯入 ${students.length} 位B班學生...`);
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    try {
      const response = await fetch(`${API_BASE}/api/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: student.name,
          studentId: student.studentId,
          email: student.email,
          class: 'B'  // 設定為B班
        })
      });
      
      if (response.ok) {
        successCount++;
        console.log(`✓ [${i + 1}/${students.length}] ${student.studentId} - ${student.name}`);
      } else {
        const error = await response.json();
        errorCount++;
        const errorMsg = `✗ [${i + 1}/${students.length}] ${student.studentId} - ${student.name}: ${error.error}`;
        console.log(errorMsg);
        errors.push(errorMsg);
      }
    } catch (error) {
      errorCount++;
      const errorMsg = `✗ [${i + 1}/${students.length}] ${student.studentId} - ${student.name}: ${error.message}`;
      console.log(errorMsg);
      errors.push(errorMsg);
    }
    
    // 避免太快發送請求
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n=== B班匯入結果 ===');
  console.log(`成功: ${successCount} 位`);
  console.log(`失敗: ${errorCount} 位`);
  
  if (errors.length > 0) {
    console.log('\n失敗詳情:');
    errors.forEach(error => console.log(error));
  }
  
  return { successCount, errorCount, errors };
}

// 驗證B班匯入結果
async function verifyBClassImport() {
  try {
    const [bClassResponse, totalResponse] = await Promise.all([
      fetch('http://localhost:3000/api/students?class=B'),
      fetch('http://localhost:3000/api/students')
    ]);
    
    if (bClassResponse.ok && totalResponse.ok) {
      const bClassStudents = await bClassResponse.json();
      const allStudents = await totalResponse.json();
      
      console.log(`\n=== 驗證結果 ===`);
      console.log(`資料庫中B班學生: ${bClassStudents.length} 位`);
      console.log(`資料庫中總學生數: ${allStudents.length} 位`);
      
      // 統計各班人數
      const aClassCount = allStudents.filter(s => s.class === 'A').length;
      const bClassCount = allStudents.filter(s => s.class === 'B').length;
      
      console.log(`A班: ${aClassCount} 位`);
      console.log(`B班: ${bClassCount} 位`);
      
      return bClassStudents.length;
    }
  } catch (error) {
    console.error('驗證失敗:', error);
    return 0;
  }
}

// 主程式
async function main() {
  try {
    // 1. 清理B班資料
    const cleanStudents = cleanBClassStudentData();
    
    if (cleanStudents.length === 0) {
      console.error('沒有有效的B班學生資料可匯入');
      return;
    }
    
    // 2. 批量匯入B班
    const result = await batchInsertBClass(cleanStudents);
    
    // 3. 驗證結果
    await verifyBClassImport();
    
    console.log('\nB班匯入作業完成！');
    
  } catch (error) {
    console.error('B班匯入過程發生錯誤:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { cleanBClassStudentData, batchInsertBClass, verifyBClassImport };
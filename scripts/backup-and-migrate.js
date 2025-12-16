const fs = require('fs');
const path = require('path');

// 備份現有學生資料
async function backupExistingData() {
  try {
    console.log('正在備份現有學生資料...');
    
    // 獲取所有學生
    const response = await fetch('http://localhost:3000/api/students');
    if (!response.ok) {
      throw new Error('無法獲取學生資料');
    }
    
    const students = await response.json();
    console.log(`找到 ${students.length} 位學生`);
    
    // 按班級分類
    const aClassStudents = students.filter(s => s.class === 'A');
    const bClassStudents = students.filter(s => s.class === 'B');
    
    console.log(`A班: ${aClassStudents.length} 位`);
    console.log(`B班: ${bClassStudents.length} 位`);
    
    // 保存備份
    const backupDir = path.join(__dirname, '../backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `students-backup-${timestamp}.json`);
    
    const backupData = {
      timestamp: new Date().toISOString(),
      totalStudents: students.length,
      aClassCount: aClassStudents.length,
      bClassCount: bClassStudents.length,
      students: students.map(s => ({
        name: s.name,
        studentId: s.studentId,
        email: s.email,
        class: s.class
      }))
    };
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`學生資料已備份到: ${backupFile}`);
    
    return backupData;
    
  } catch (error) {
    console.error('備份失敗:', error);
    throw error;
  }
}

// 創建預設課程
async function createDefaultCourses() {
  try {
    console.log('正在創建預設課程...');
    
    // 創建"3D電腦繪圖"課程
    const course3D = {
      name: '3D電腦繪圖',
      code: 'IC335',
      description: '3D電腦繪圖與動畫製作課程'
    };
    
    const response = await fetch('http://localhost:3000/api/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(course3D)
    });
    
    if (!response.ok) {
      throw new Error('創建3D電腦繪圖課程失敗');
    }
    
    const createdCourse = await response.json();
    console.log('✓ 已創建課程:', createdCourse.name);
    
    return createdCourse;
    
  } catch (error) {
    console.error('創建課程失敗:', error);
    throw error;
  }
}

// 重新匯入學生資料（包含課程資訊）
async function reImportStudentsWithCourse(backupData, courseId) {
  console.log(`正在重新匯入 ${backupData.students.length} 位學生...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < backupData.students.length; i++) {
    const student = backupData.students[i];
    
    try {
      const response = await fetch('http://localhost:3000/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: student.name,
          studentId: student.studentId,
          email: student.email,
          class: student.class,
          courseId: courseId
        })
      });
      
      if (response.ok) {
        successCount++;
        console.log(`✓ [${i + 1}/${backupData.students.length}] ${student.studentId} - ${student.name}`);
      } else {
        const error = await response.json();
        errorCount++;
        console.log(`✗ [${i + 1}/${backupData.students.length}] ${student.studentId} - ${student.name}: ${error.error}`);
      }
      
    } catch (error) {
      errorCount++;
      console.log(`✗ [${i + 1}/${backupData.students.length}] ${student.studentId} - ${student.name}: ${error.message}`);
    }
    
    // 避免請求過快
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`\n重新匯入結果: 成功 ${successCount} 位，失敗 ${errorCount} 位`);
  return { successCount, errorCount };
}

// 主程式
async function main() {
  try {
    // 1. 備份現有資料
    const backupData = await backupExistingData();
    
    console.log('\n⚠️  即將重置資料庫並重新匯入資料...');
    console.log('請確認已備份完成，按 Ctrl+C 取消或等待3秒後自動繼續...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n開始重置資料庫...');
    
    return { backupData };
    
  } catch (error) {
    console.error('遷移過程發生錯誤:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { backupExistingData, createDefaultCourses, reImportStudentsWithCourse };
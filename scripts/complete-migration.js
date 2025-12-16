const fs = require('fs');
const path = require('path');

// 創建"3D電腦繪圖"課程
async function create3DCourse() {
  try {
    console.log('正在創建"3D電腦繪圖"課程...');
    
    const course3D = {
      name: '3D電腦繪圖',
      code: 'IC335',
      description: '3D電腦繪圖與動畫製作課程，包含A班和B班'
    };
    
    const response = await fetch('http://localhost:3000/api/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(course3D)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '創建課程失敗');
    }
    
    const createdCourse = await response.json();
    console.log('✓ 已創建課程:', createdCourse.name, `(ID: ${createdCourse.id})`);
    
    return createdCourse;
    
  } catch (error) {
    console.error('創建課程失敗:', error);
    throw error;
  }
}

// 從備份檔案重新匯入學生
async function reImportStudents(courseId) {
  try {
    // 找到最新的備份檔案
    const backupDir = path.join(__dirname, '../backup');
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('students-backup-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backupFiles.length === 0) {
      throw new Error('找不到學生備份檔案');
    }
    
    const latestBackupFile = path.join(backupDir, backupFiles[0]);
    console.log(`正在從備份檔案恢復學生資料: ${latestBackupFile}`);
    
    const backupData = JSON.parse(fs.readFileSync(latestBackupFile, 'utf8'));
    console.log(`找到 ${backupData.students.length} 位學生資料`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
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
            courseId: courseId  // 關聯到3D電腦繪圖課程
          })
        });
        
        if (response.ok) {
          successCount++;
          console.log(`✓ [${i + 1}/${backupData.students.length}] ${student.studentId} - ${student.name} (${student.class}班)`);
        } else {
          const error = await response.json();
          errorCount++;
          const errorMsg = `✗ [${i + 1}/${backupData.students.length}] ${student.studentId} - ${student.name}: ${error.error}`;
          console.log(errorMsg);
          errors.push(errorMsg);
        }
        
      } catch (error) {
        errorCount++;
        const errorMsg = `✗ [${i + 1}/${backupData.students.length}] ${student.studentId} - ${student.name}: ${error.message}`;
        console.log(errorMsg);
        errors.push(errorMsg);
      }
      
      // 避免請求過快
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`\n=== 學生重新匯入結果 ===`);
    console.log(`成功: ${successCount} 位`);
    console.log(`失敗: ${errorCount} 位`);
    
    if (errors.length > 0) {
      console.log('\n失敗詳情:');
      errors.forEach(error => console.log(error));
    }
    
    return { successCount, errorCount };
    
  } catch (error) {
    console.error('重新匯入學生失敗:', error);
    throw error;
  }
}

// 驗證遷移結果
async function verifyMigration() {
  try {
    console.log('\n正在驗證遷移結果...');
    
    // 檢查課程
    const coursesResponse = await fetch('http://localhost:3000/api/courses');
    if (!coursesResponse.ok) {
      throw new Error('無法獲取課程列表');
    }
    const courses = await coursesResponse.json();
    
    // 檢查學生
    const studentsResponse = await fetch('http://localhost:3000/api/students');
    if (!studentsResponse.ok) {
      throw new Error('無法獲取學生列表');
    }
    const students = await studentsResponse.json();
    
    console.log('\n=== 驗證結果 ===');
    console.log(`課程數量: ${courses.length}`);
    courses.forEach(course => {
      console.log(`  - ${course.name} (${course.code}): ${course._count?.students || 0} 位學生`);
    });
    
    console.log(`\n學生總數: ${students.length}`);
    const aClassCount = students.filter(s => s.class === 'A').length;
    const bClassCount = students.filter(s => s.class === 'B').length;
    console.log(`  - A班: ${aClassCount} 位`);
    console.log(`  - B班: ${bClassCount} 位`);
    
    return { courses, students };
    
  } catch (error) {
    console.error('驗證失敗:', error);
    throw error;
  }
}

// 主程式
async function main() {
  try {
    console.log('開始執行完整遷移...\n');
    
    // 1. 創建3D電腦繪圖課程
    const course3D = await create3DCourse();
    
    // 2. 重新匯入學生資料
    await reImportStudents(course3D.id);
    
    // 3. 驗證結果
    await verifyMigration();
    
    console.log('\n🎉 多課程架構遷移完成！');
    console.log('系統現在支援多課程管理，所有A班和B班學生已關聯到"3D電腦繪圖"課程。');
    
  } catch (error) {
    console.error('\n❌ 遷移過程發生錯誤:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { create3DCourse, reImportStudents, verifyMigration };
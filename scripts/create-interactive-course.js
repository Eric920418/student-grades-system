// 創建"互動投影"課程
async function createInteractiveCourse() {
  try {
    console.log('正在創建"互動投影"課程...');
    
    const interactiveCourse = {
      name: '互動投影',
      code: 'IC336', // 假設課程代碼
      description: '互動投影技術與應用課程'
    };
    
    const response = await fetch('http://localhost:3000/api/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(interactiveCourse)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '創建互動投影課程失敗');
    }
    
    const createdCourse = await response.json();
    console.log('✓ 已創建課程:', createdCourse.name, `(ID: ${createdCourse.id})`);
    
    return createdCourse;
    
  } catch (error) {
    console.error('創建互動投影課程失敗:', error);
    throw error;
  }
}

// 驗證現有課程
async function verifyCourses() {
  try {
    console.log('\n正在驗證課程列表...');
    
    const response = await fetch('http://localhost:3000/api/courses');
    if (!response.ok) {
      throw new Error('無法獲取課程列表');
    }
    const courses = await response.json();
    
    console.log('\n=== 現有課程 ===');
    courses.forEach(course => {
      console.log(`- ${course.name} (${course.code || 'N/A'}): ${course._count?.students || 0} 位學生`);
      console.log(`  描述: ${course.description || '無描述'}`);
    });
    
    return courses;
    
  } catch (error) {
    console.error('驗證課程失敗:', error);
    throw error;
  }
}

// 主程式
async function main() {
  try {
    console.log('開始創建互動投影課程...\n');
    
    // 1. 創建互動投影課程
    const interactiveCourse = await createInteractiveCourse();
    
    // 2. 驗證所有課程
    await verifyCourses();
    
    console.log('\n🎉 互動投影課程創建完成！');
    console.log('系統現在支援兩個課程：3D電腦繪圖 和 互動投影');
    console.log('你可以在首頁選擇不同的課程進行管理。');
    
  } catch (error) {
    console.error('\n❌ 創建過程發生錯誤:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createInteractiveCourse, verifyCourses };
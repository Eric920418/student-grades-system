const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGradeItems() {
  try {
    console.log('=== 檢查成績項目分布 ===\n');

    // 獲取所有課程
    const courses = await prisma.course.findMany({
      include: {
        gradeItems: true
      }
    });

    if (courses.length === 0) {
      console.log('❌ 資料庫中沒有課程資料');
      return;
    }

    // 顯示每個課程的成績項目
    for (const course of courses) {
      console.log(`📚 課程：${course.name} (ID: ${course.id})`);
      console.log(`   課程代碼：${course.code || '無'}`);
      console.log(`   成績項目數量：${course.gradeItems.length}`);

      if (course.gradeItems.length > 0) {
        console.log('   項目列表：');
        course.gradeItems.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.name} (權重: ${(item.weight * 100).toFixed(0)}%, 滿分: ${item.maxScore})`);
        });
      } else {
        console.log('   ⚠️  此課程尚無成績項目');
      }
      console.log('');
    }

    // 統計總數
    const totalGradeItems = await prisma.gradeItem.count();
    console.log(`📊 總計：${courses.length} 門課程，${totalGradeItems} 個成績項目`);

  } catch (error) {
    console.error('❌ 檢查失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGradeItems();

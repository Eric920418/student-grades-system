const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 從 SQLite 讀取 JSON 數據
function readSqliteTable(table) {
  try {
    const result = execSync(
      `sqlite3 prisma/dev.db "SELECT * FROM ${table};" -json`,
      { encoding: 'utf-8' }
    );
    return JSON.parse(result || '[]');
  } catch (error) {
    console.error(`讀取 ${table} 失敗:`, error.message);
    return [];
  }
}

async function migrate() {
  console.log('開始遷移數據到 Neon...\n');

  try {
    // 1. 遷移 courses
    console.log('遷移 courses...');
    const courses = readSqliteTable('courses');
    for (const course of courses) {
      await prisma.course.upsert({
        where: { id: course.id },
        update: {},
        create: {
          id: course.id,
          name: course.name,
          code: course.code,
          description: course.description,
          createdAt: new Date(course.createdAt),
          updatedAt: new Date(course.updatedAt),
        },
      });
    }
    console.log(`  ✓ ${courses.length} 筆課程`);

    // 2. 遷移 students
    console.log('遷移 students...');
    const students = readSqliteTable('students');
    for (const student of students) {
      await prisma.student.upsert({
        where: { id: student.id },
        update: {},
        create: {
          id: student.id,
          name: student.name,
          studentId: student.studentId,
          email: student.email,
          class: student.class,
          courseId: student.courseId,
          createdAt: new Date(student.createdAt),
          updatedAt: new Date(student.updatedAt),
        },
      });
    }
    console.log(`  ✓ ${students.length} 筆學生`);

    // 3. 遷移 groups
    console.log('遷移 groups...');
    const groups = readSqliteTable('groups');
    for (const group of groups) {
      await prisma.group.upsert({
        where: { id: group.id },
        update: {},
        create: {
          id: group.id,
          name: group.name,
          description: group.description,
          courseId: group.courseId,
          createdAt: new Date(group.createdAt),
          updatedAt: new Date(group.updatedAt),
        },
      });
    }
    console.log(`  ✓ ${groups.length} 筆分組`);

    // 4. 遷移 student_groups
    console.log('遷移 student_groups...');
    const studentGroups = readSqliteTable('student_groups');
    for (const sg of studentGroups) {
      await prisma.studentGroup.upsert({
        where: { id: sg.id },
        update: {},
        create: {
          id: sg.id,
          studentId: sg.studentId,
          groupId: sg.groupId,
          role: sg.role,
          createdAt: new Date(sg.createdAt),
        },
      });
    }
    console.log(`  ✓ ${studentGroups.length} 筆學生分組關聯`);

    // 5. 遷移 grade_items
    console.log('遷移 grade_items...');
    const gradeItems = readSqliteTable('grade_items');
    for (const item of gradeItems) {
      await prisma.gradeItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          name: item.name,
          weight: item.weight,
          maxScore: item.maxScore,
          courseId: item.courseId,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
      });
    }
    console.log(`  ✓ ${gradeItems.length} 筆成績項目`);

    // 6. 遷移 grades
    console.log('遷移 grades...');
    const grades = readSqliteTable('grades');
    for (const grade of grades) {
      await prisma.grade.upsert({
        where: { id: grade.id },
        update: {},
        create: {
          id: grade.id,
          studentId: grade.studentId,
          gradeItemId: grade.gradeItemId,
          score: grade.score,
          createdAt: new Date(grade.createdAt),
          updatedAt: new Date(grade.updatedAt),
        },
      });
    }
    console.log(`  ✓ ${grades.length} 筆成績`);

    console.log('\n✅ 數據遷移完成！');

  } catch (error) {
    console.error('遷移失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();

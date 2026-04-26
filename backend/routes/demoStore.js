// Initial demo data to keep the simulation alive when DB is offline
const initialCourses = [
  {
    _id: 'demo-course-123',
    title: 'Assessment UI Demo - Foundation',
    description: 'A special demo course to showcase the high-fidelity Assessment/Quiz UI designed matching your requirements.',
    thumbnail: '',
    isPublished: true,
    createdBy: { name: 'Institutional Demo' },
    createdAt: new Date(),
    modules: ['demo-mod-1'],
    enrolledStudents: []
  }
];

const initialQuizzes = [
  {
    _id: 'demo-quiz-123',
    title: 'CUBE HIGHWAYS',
    courseId: 'demo-course-123',
    timeLimitSeconds: 3600,
    questions: Array.from({ length: 15 }, (_, i) => ({
      _id: `q${i}`,
      question: i === 0 
        ? 'When 2/5th of a fraction A is added to 3/6th of another fraction B, the result is 5/12. If fraction A is 13/72 more than fraction B. What is the product of A and B?' 
        : `Sample Question ${i + 1} for assessment demonstration purposes.`,
      options: ['3/16', '5/18', '10/27', '10/27'],
      correctAnswer: 1
    })),
    passingScore: 60
  }
];

const initialModules = [
  {
    _id: 'demo-mod-1',
    courseId: 'demo-course-123',
    title: 'Part A: Foundation Section - 1 (Assessment)',
    type: 'quiz',
    quizId: 'demo-quiz-123',
    order: 0
  }
];

const demoStore = {
  courses: [...initialCourses],
  quizzes: [...initialQuizzes],
  modules: [...initialModules]
};

module.exports = demoStore;

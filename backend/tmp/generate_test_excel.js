const xlsx = require('xlsx');
const path = require('path');

const data = [
  {
    'Question': 'What is the capital of France?',
    'Option A': 'London',
    'Option B': 'Berlin',
    'Option C': 'Paris',
    'Option D': 'Madrid',
    'Correct Answer': 'C'
  },
  {
    'Question': 'Which planet is known as the Red Planet?',
    'Option A': 'Venus',
    'Option B': 'Mars',
    'Option C': 'Jupiter',
    'Option D': 'Saturn',
    'Correct Answer': 'B'
  },
  {
    'Question': 'What is 5 + 7?',
    'Option A': '10',
    'Option B': '11',
    'Option C': '12',
    'Option D': '13',
    'Correct Answer': 'C'
  }
];

const ws = xlsx.utils.json_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Questions');

const outputPath = path.resolve(__dirname, 'test_questions.xlsx');
xlsx.writeFile(wb, outputPath);

console.log(`Excel file created at: ${outputPath}`);

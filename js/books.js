// ============================================================
// The books of the library and the numbers of the tests in each.
// The content of a test lives in content/<id>/test<number>/.
// To add a book, add a line here.
// ============================================================

window.C1_BOOKS = [
  { id: 'cae1', title: 'Cambridge English Advanced 1', tests: [1, 2, 3, 4] },
  { id: 'cae2', title: 'Cambridge English Advanced 2', tests: [5, 6, 7, 8] },
  { id: 'cae3', title: 'Cambridge English Advanced 3', tests: [1, 2, 3, 4] },
  { id: 'cae4', title: 'Cambridge English Advanced 4', tests: [1, 2, 3, 4] },
  { id: 'cae5', title: 'Cambridge English Advanced 5', tests: [1, 2, 3, 4] },
  { id: 'trainer1', title: 'Advanced Trainer', tests: [1, 2, 3, 4, 5, 6] },
  { id: 'trainer2', title: 'C1 Advanced Trainer 2', tests: [1, 2, 3, 4, 5, 6] },
  { id: 'pearson', title: 'Pearson tests', tests: [1, 2] },
];

window.C1_BOOK = function (id) {
  return window.C1_BOOKS.find(function (b) { return b.id === id; }) || null;
};

// timer/timer.test.js
const { formatTime, tick } = require('./timer');

test('formatTime converts seconds to MM:SS', () => {
  expect(formatTime(0)).toBe('00:00');
  expect(formatTime(5)).toBe('00:05');
  expect(formatTime(65)).toBe('01:05');
  expect(formatTime(600)).toBe('10:00');
});

test('tick decreases by one and floors at zero', () => {
  expect(tick(10)).toBe(9);
  expect(tick(1)).toBe(0);
  expect(tick(0)).toBe(0);
});

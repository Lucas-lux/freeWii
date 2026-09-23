/** Light-hearted questions. Two or three choices each; the "crowd" answer is simulated. */
export interface Question {
  q: string;
  choices: string[];
}

export const QUESTIONS: Question[] = [
  { q: 'Cats or dogs?', choices: ['Cats', 'Dogs'] },
  { q: 'Pineapple on pizza?', choices: ['Yes please', 'Never', 'Only on Fridays'] },
  { q: 'Would you rather…', choices: ['Fly', 'Be invisible'] },
  { q: 'Morning person or night owl?', choices: ['Morning', 'Night owl'] },
  { q: 'Best pizza topping?', choices: ['Cheese', 'Pepperoni', 'Mushrooms'] },
  { q: 'Beach or mountains?', choices: ['Beach', 'Mountains'] },
  { q: 'Coffee or tea?', choices: ['Coffee', 'Tea', 'Hot chocolate'] },
  { q: 'Do you sing in the shower?', choices: ['Always', 'Sometimes', 'Never'] },
  { q: 'Which superpower?', choices: ['Time travel', 'Read minds', 'Super strength'] },
  { q: 'Sweet or salty snacks?', choices: ['Sweet', 'Salty'] },
  { q: 'Summer or winter?', choices: ['Summer', 'Winter'] },
  { q: 'Toilet paper: over or under?', choices: ['Over', 'Under'] },
  { q: 'Is a hot dog a sandwich?', choices: ['Yes', 'No'] },
  { q: 'Which would you rather ride?', choices: ['Dragon', 'Giant eagle', 'Unicorn'] },
  { q: 'Pancakes or waffles?', choices: ['Pancakes', 'Waffles'] },
  { q: 'Books or movies?', choices: ['Books', 'Movies'] },
  { q: 'Do you believe in aliens?', choices: ['Definitely', 'Nope', 'Maybe'] },
  { q: 'Best way to spend a rainy day?', choices: ['Video games', 'Nap', 'Baking'] },
  { q: 'Would you eat a bug for €100?', choices: ['Sure', 'No way'] },
  { q: 'Text or call?', choices: ['Text', 'Call'] },
  { q: 'Window or aisle seat?', choices: ['Window', 'Aisle'] },
  { q: 'Cereal: milk first or cereal first?', choices: ['Cereal first', 'Milk first'] },
  { q: 'Which pet would you adopt?', choices: ['Hamster', 'Parrot', 'Snake'] },
  { q: 'Do you like your own handwriting?', choices: ['Yes', 'No'] },
  { q: 'Best decade for music?', choices: ['80s', '90s', '2000s'] },
  { q: 'Would you rather be…', choices: ['Very rich', 'Very famous'] },
  { q: 'Fries with…', choices: ['Ketchup', 'Mayo', 'Nothing'] },
  { q: 'Can you touch your toes?', choices: ['Easily', 'Barely', 'No'] },
  { q: 'Robots or dinosaurs?', choices: ['Robots', 'Dinosaurs'] },
  { q: 'Would you live on Mars?', choices: ['Sign me up', 'Earth is fine'] },
  { q: 'Socks in bed?', choices: ['Yes', 'Absolutely not'] },
  { q: 'Which is scarier?', choices: ['Spiders', 'Public speaking', 'Clowns'] },
  { q: 'Do you talk to your plants?', choices: ['Yes', 'No', 'I have no plants'] },
  { q: 'Burger or sushi?', choices: ['Burger', 'Sushi'] },
  { q: 'Would you rather never use…', choices: ['Social media', 'Video games'] },
  { q: 'Do you dance when nobody watches?', choices: ['All the time', 'Never'] },
  { q: 'Best breakfast?', choices: ['Eggs', 'Croissant', 'Fruit'] },
  { q: 'Can you whistle?', choices: ['Yes', 'No'] },
  { q: 'Board games or video games?', choices: ['Board games', 'Video games'] },
  { q: 'Which season starts the year best?', choices: ['Spring', 'Autumn'] },
];

/** Simulated crowd share for each choice, in percent, summing to 100 with a clear winner. */
export function crowdFor(q: Question): number[] {
  const n = q.choices.length;
  const fav = Math.floor(Math.random() * n);
  const favShare = n === 2 ? 52 + Math.floor(Math.random() * 30) : 42 + Math.floor(Math.random() * 25);
  const rest = 100 - favShare;
  const out: number[] = Array(n).fill(0);
  out[fav] = favShare;
  if (n === 2) out[1 - fav] = rest;
  else {
    const others = [0, 1, 2].filter((i) => i !== fav);
    const a = Math.floor(rest * (0.3 + Math.random() * 0.4));
    out[others[0]] = a;
    out[others[1]] = rest - a;
    if (out[others[0]] === out[others[1]]) out[others[0]] += 1, (out[others[1]] -= 1);
  }
  return out;
}

export const TICKETS_PER_WEEK = 100;
export const PRICE_PER_TICKET = 1_000;

export function rankFromMatches(matches, bonusMatched) {
  if (matches === 6) return 1;
  if (matches === 5 && bonusMatched) return 2;
  if (matches === 5) return 3;
  if (matches === 4) return 4;
  if (matches === 3) return 5;
  return null;
}

export function classifyDraw(selectedNumbers, winningNumbers, bonusNumber) {
  if (new Set(selectedNumbers).size !== 6 || new Set(winningNumbers).size !== 6) {
    throw new Error('선택 번호와 당첨 번호는 중복 없는 6개여야 합니다.');
  }

  const selected = new Set(selectedNumbers);
  const matches = winningNumbers.reduce(
    (count, number) => count + (selected.has(number) ? 1 : 0),
    0,
  );

  return rankFromMatches(matches, selected.has(bonusNumber));
}

export function ticketsForWeeks(weeks) {
  return weeks * TICKETS_PER_WEEK;
}

export function costForWeeks(weeks) {
  return ticketsForWeeks(weeks) * PRICE_PER_TICKET;
}

export function yearsForWeeks(weeks) {
  return weeks / 52;
}

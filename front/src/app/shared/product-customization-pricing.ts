export interface CustomizationPricingQuestion {
  id: number;
  options?: unknown;
}

export function customizationPriceDeltaCents(
  questions: CustomizationPricingQuestion[] | null | undefined,
  answers: Partial<Record<string, string | number | string[]>> | null | undefined,
): number {
  if (!questions?.length || !answers) return 0;
  return questions.reduce((total, question) => {
    const options = question.options;
    if (!options || typeof options !== 'object' || Array.isArray(options)) return total;
    const pricing = (options as Record<string, unknown>)['pricing'];
    if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) return total;
    const policy = pricing as Record<string, unknown>;
    if (policy['type'] !== 'item_count') return total;
    const answer = answers[String(question.id)];
    const choices: unknown[] = Array.isArray(answer) ? answer : answer == null || answer === '' ? [] : [answer];
    const includedRaw = Number(policy['included'] ?? 1);
    const secondRaw = Number(policy['second_item_delta_cents'] ?? 0);
    const additionalRaw = Number(policy['additional_item_delta_cents'] ?? 0);
    if (![includedRaw, secondRaw, additionalRaw].every(Number.isFinite)) return total;
    const included = Math.max(0, includedRaw);
    const extraCount = Math.max(0, choices.length - included);
    const second = Math.max(0, secondRaw);
    const additional = Math.max(0, additionalRaw);
    const surchargeMap = policy['choice_surcharges_cents'];
    const surcharges = surchargeMap && typeof surchargeMap === 'object' && !Array.isArray(surchargeMap)
      ? surchargeMap as Record<string, unknown>
      : {};
    const surchargeTotal = choices.reduce<number>(
      (sum, choice) => {
        const surcharge = Number(surcharges[String(choice)] ?? 0);
        return sum + (Number.isFinite(surcharge) ? Math.max(0, surcharge) : 0);
      },
      0,
    );
    return total + (extraCount ? second + Math.max(0, extraCount - 1) * additional : 0) + surchargeTotal;
  }, 0);
}

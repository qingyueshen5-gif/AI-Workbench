import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const verificationDir = process.env.AIW_SURVIVAL_COST_DIR
  ? resolve(process.env.AIW_SURVIVAL_COST_DIR)
  : resolve(root, 'verification/survival-cost-audit');

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON at ${path}: ${error.message}`);
  }
}

function assertPositiveNumber(value, path) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${path} must be a positive number`);
}

function assertNonNegativeNumber(value, path) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${path} must be a non-negative number`);
}

function validatePricing(pricing) {
  assertPositiveNumber(pricing.exchange_rate.usd_to_cny, 'exchange_rate.usd_to_cny');
  assertPositiveNumber(pricing.current_provider.input_cache_miss_usd_per_million_tokens, 'current_provider.input_cache_miss_usd_per_million_tokens');
  assertPositiveNumber(pricing.current_provider.output_usd_per_million_tokens, 'current_provider.output_usd_per_million_tokens');
  assertNonNegativeNumber(pricing.current_provider.input_cache_hit_usd_per_million_tokens, 'current_provider.input_cache_hit_usd_per_million_tokens');
  assertNonNegativeNumber(pricing.infrastructure.fixed_monthly_usd, 'infrastructure.fixed_monthly_usd');
  assertNonNegativeNumber(pricing.infrastructure.variable_monthly_usd, 'infrastructure.variable_monthly_usd');
}

function validateAssumptions(assumptions) {
  assertPositiveNumber(assumptions.monthly_days, 'monthly_days');
  assertPositiveNumber(assumptions.current_baseline_monthly_burn_cny, 'current_baseline_monthly_burn_cny');
  assertPositiveNumber(assumptions.current_runway_months, 'current_runway_months');
}

function validateScenario(scenario, index) {
  const prefix = `scenarios[${index}]`;
  assertPositiveNumber(scenario.users, `${prefix}.users`);
  assertPositiveNumber(scenario.requests_per_user_per_day, `${prefix}.requests_per_user_per_day`);
  assertPositiveNumber(scenario.input_tokens_per_upstream_call, `${prefix}.input_tokens_per_upstream_call`);
  assertPositiveNumber(scenario.output_tokens_per_upstream_call, `${prefix}.output_tokens_per_upstream_call`);
  assertPositiveNumber(scenario.upstream_calls_per_user_request, `${prefix}.upstream_calls_per_user_request`);
  assertPositiveNumber(scenario.retry_multiplier, `${prefix}.retry_multiplier`);
  assertNonNegativeNumber(scenario.cache_hit_rate, `${prefix}.cache_hit_rate`);
  if (scenario.cache_hit_rate > 1) throw new Error(`${prefix}.cache_hit_rate must be <= 1`);
}

function money(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function calculate() {
  const assumptions = readJson(resolve(verificationDir, 'assumptions.json'));
  const pricing = readJson(resolve(verificationDir, 'pricing-sources.json'));
  const scenarios = readJson(resolve(verificationDir, 'scenarios.json'));

  validateAssumptions(assumptions);
  validatePricing(pricing);
  if (!Array.isArray(scenarios.scenarios) || scenarios.scenarios.length === 0) throw new Error('scenarios.scenarios must be a non-empty array');
  scenarios.scenarios.forEach(validateScenario);

  const usdToCny = pricing.exchange_rate.usd_to_cny;
  const provider = pricing.current_provider;
  const cashReserveCny = assumptions.current_baseline_monthly_burn_cny * assumptions.current_runway_months;

  const results = scenarios.scenarios.map((scenario) => {
    const effectiveInputPrice = (
      scenario.cache_hit_rate * provider.input_cache_hit_usd_per_million_tokens
      + (1 - scenario.cache_hit_rate) * provider.input_cache_miss_usd_per_million_tokens
    ) / 1_000_000;
    const outputPrice = provider.output_usd_per_million_tokens / 1_000_000;
    const upstreamCallCostUsd =
      scenario.input_tokens_per_upstream_call * effectiveInputPrice
      + scenario.output_tokens_per_upstream_call * outputPrice;
    const userRequestCostUsd = upstreamCallCostUsd * scenario.upstream_calls_per_user_request * scenario.retry_multiplier;
    const monthlyModelCostUsd =
      scenario.users
      * scenario.requests_per_user_per_day
      * assumptions.monthly_days
      * userRequestCostUsd;
    const monthlyInfrastructureCostUsd = pricing.infrastructure.fixed_monthly_usd + pricing.infrastructure.variable_monthly_usd;
    const monthlyPlatformTotalUsd = monthlyModelCostUsd + monthlyInfrastructureCostUsd;
    const monthlyPlatformTotalCny = monthlyPlatformTotalUsd * usdToCny;
    const totalMonthlyBurnCny = assumptions.current_baseline_monthly_burn_cny + monthlyPlatformTotalCny;
    const runwayMonths = cashReserveCny / totalMonthlyBurnCny;

    return {
      scenario: scenario.name,
      users: scenario.users,
      requests_per_user_per_day: scenario.requests_per_user_per_day,
      input_tokens_per_request: scenario.input_tokens_per_upstream_call,
      output_tokens_per_request: scenario.output_tokens_per_upstream_call,
      upstream_calls_per_user_request: scenario.upstream_calls_per_user_request,
      retry_multiplier: scenario.retry_multiplier,
      cache_hit_rate: scenario.cache_hit_rate,
      single_upstream_call_cost_usd: money(upstreamCallCostUsd),
      single_user_request_cost_usd: money(userRequestCostUsd),
      monthly_model_cost_usd: money(monthlyModelCostUsd),
      monthly_infrastructure_cost_usd: money(monthlyInfrastructureCostUsd),
      monthly_platform_total_usd: money(monthlyPlatformTotalUsd),
      monthly_platform_total_cny: money(monthlyPlatformTotalCny, 2),
      total_monthly_burn_with_current_8200_cny: money(totalMonthlyBurnCny, 2),
      estimated_runway_months: money(runwayMonths, 2),
      data_type: scenario.data_type,
      confidence: scenario.confidence,
      primary_risk: scenario.primary_risk
    };
  });

  const marginal = results.find((item) => item.users === 100) || results[0];
  const marginalMonthlyModelUsdPerUser =
    marginal.monthly_model_cost_usd / marginal.users;

  return {
    generated_at: assumptions.generated_at,
    formulas: {
      upstream_call_cost: 'input_tokens * blended_input_unit_price + output_tokens * output_unit_price + cache/other_items',
      user_request_cost: 'upstream_call_cost * upstream_calls_per_user_request * retry_multiplier',
      monthly_model_cost: 'users * requests_per_user_per_day * monthly_days * user_request_cost',
      monthly_platform_total: 'monthly_model_cost + infrastructure_fixed + infrastructure_variable'
    },
    current_hard_monthly_cap: null,
    theoretical_worst_case: 'unbounded',
    current_code_reference_limits: assumptions.current_code_reference_limits,
    observed_data: assumptions.observed_data,
    marginal_high_active_user_monthly_model_cost_usd: money(marginalMonthlyModelUsdPerUser),
    marginal_high_active_user_monthly_model_cost_cny: money(marginalMonthlyModelUsdPerUser * usdToCny, 2),
    results
  };
}

try {
  mkdirSync(verificationDir, { recursive: true });
  const result = calculate();
  const output = resolve(verificationDir, 'cost-results.json');
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

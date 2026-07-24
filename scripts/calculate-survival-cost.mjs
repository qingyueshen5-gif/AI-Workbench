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

function upstreamCallCostUsd(provider, scenario) {
  const effectiveInputPrice = (
    scenario.cache_hit_rate * provider.input_cache_hit_usd_per_million_tokens
    + (1 - scenario.cache_hit_rate) * provider.input_cache_miss_usd_per_million_tokens
  ) / 1_000_000;
  const outputPrice = provider.output_usd_per_million_tokens / 1_000_000;
  return scenario.input_tokens_per_upstream_call * effectiveInputPrice
    + scenario.output_tokens_per_upstream_call * outputPrice;
}

function runway(cashReserveCny, baselineMonthlyBurnCny, platformMonthlyCostCny) {
  return cashReserveCny / (baselineMonthlyBurnCny + platformMonthlyCostCny);
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

  const uncappedDemandPressure = scenarios.scenarios.map((scenario) => {
    const upstreamCostUsd = upstreamCallCostUsd(provider, scenario);
    const userRequestCostUsd = upstreamCostUsd * scenario.upstream_calls_per_user_request * scenario.retry_multiplier;
    const monthlyModelCostUsd =
      scenario.users
      * scenario.requests_per_user_per_day
      * assumptions.monthly_days
      * userRequestCostUsd;
    const monthlyInfrastructureCostUsd = pricing.infrastructure.fixed_monthly_usd + pricing.infrastructure.variable_monthly_usd;
    const monthlyPlatformTotalUsd = monthlyModelCostUsd + monthlyInfrastructureCostUsd;
    const monthlyPlatformTotalCny = monthlyPlatformTotalUsd * usdToCny;
    const totalMonthlyBurnCny = assumptions.current_baseline_monthly_burn_cny + monthlyPlatformTotalCny;
    const runwayMonths = runway(cashReserveCny, assumptions.current_baseline_monthly_burn_cny, monthlyPlatformTotalCny);

    return {
      scenario: scenario.name,
      scenario_group: 'uncapped_demand_pressure',
      users: scenario.users,
      requests_per_user_per_day: scenario.requests_per_user_per_day,
      input_tokens_per_request: scenario.input_tokens_per_upstream_call,
      output_tokens_per_request: scenario.output_tokens_per_upstream_call,
      upstream_calls_per_user_request: scenario.upstream_calls_per_user_request,
      retry_multiplier: scenario.retry_multiplier,
      cache_hit_rate: scenario.cache_hit_rate,
      single_upstream_call_cost_usd: money(upstreamCostUsd),
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

  const normalTemplate = scenarios.current_enforced_normal_path || {};
  const normalTokenScenario = {
    input_tokens_per_upstream_call: normalTemplate.input_tokens_per_upstream_call || scenarios.scenarios[0].input_tokens_per_upstream_call,
    output_tokens_per_upstream_call: normalTemplate.output_tokens_per_upstream_call || scenarios.scenarios[0].output_tokens_per_upstream_call,
    cache_hit_rate: normalTemplate.cache_hit_rate ?? scenarios.scenarios[0].cache_hit_rate
  };
  const normalUpstreamCostUsd = upstreamCallCostUsd(provider, normalTokenScenario);
  const tokensPerManagedModelCall = normalTokenScenario.input_tokens_per_upstream_call + normalTokenScenario.output_tokens_per_upstream_call;
  const limits = assumptions.current_code_reference_limits;
  const sequentialTokenLimitedModelCallsPerDay = Math.ceil(limits.daily_global_token_limit / tokensPerManagedModelCall);
  const steadyStateModelCallsPerDay = Math.min(limits.daily_global_request_limit, sequentialTokenLimitedModelCallsPerDay);
  const currentEnforcedNormalPath = scenarios.scenarios.map((scenario) => {
    const registrationRequestsOnFirstDay = scenario.users;
    const firstDayRequestCapacityAfterRegistration = Math.max(0, limits.daily_global_request_limit - registrationRequestsOnFirstDay);
    const firstDayModelCalls = Math.min(firstDayRequestCapacityAfterRegistration, sequentialTokenLimitedModelCallsPerDay);
    const monthlyModelCalls = firstDayModelCalls + steadyStateModelCallsPerDay * (assumptions.monthly_days - 1);
    const monthlyModelCostUsd = monthlyModelCalls * normalUpstreamCostUsd;
    const monthlyInfrastructureCostUsd = pricing.infrastructure.fixed_monthly_usd + pricing.infrastructure.variable_monthly_usd;
    const monthlyPlatformTotalUsd = monthlyModelCostUsd + monthlyInfrastructureCostUsd;
    const monthlyPlatformTotalCny = monthlyPlatformTotalUsd * usdToCny;
    return {
      scenario: `current_enforced_normal_path_${scenario.users}_registered_users`,
      scenario_group: 'current_enforced_normal_path',
      registered_users: scenario.users,
      daily_platform_managed_proxy_request_limit: limits.daily_global_request_limit,
      daily_install_managed_proxy_request_limit: limits.daily_install_request_limit,
      daily_platform_token_limit: limits.daily_global_token_limit,
      registration_requests_on_first_day: registrationRequestsOnFirstDay,
      assumed_model_calls_per_complete_frontend_task: [1, 2],
      assumed_tokens_per_managed_model_call: tokensPerManagedModelCall,
      sequential_token_limited_model_calls_per_day: sequentialTokenLimitedModelCallsPerDay,
      steady_state_successful_model_calls_per_day_upper_bound: steadyStateModelCallsPerDay,
      first_day_successful_model_calls_upper_bound_after_registration: firstDayModelCalls,
      max_complete_frontend_tasks_per_day_if_one_call_each: steadyStateModelCallsPerDay,
      max_complete_frontend_tasks_per_day_if_two_calls_each: Math.floor(steadyStateModelCallsPerDay / 2),
      bottleneck_under_current_token_assumption: sequentialTokenLimitedModelCallsPerDay < limits.daily_global_request_limit ? 'DAILY_TOKEN_LIMIT' : 'DAILY_GLOBAL_LIMIT',
      monthly_successful_model_calls_upper_bound: monthlyModelCalls,
      single_upstream_call_cost_usd: money(normalUpstreamCostUsd),
      monthly_model_cost_usd_upper_bound: money(monthlyModelCostUsd),
      monthly_infrastructure_cost_usd: money(monthlyInfrastructureCostUsd),
      monthly_platform_total_usd_upper_bound: money(monthlyPlatformTotalUsd),
      monthly_platform_total_cny_upper_bound: money(monthlyPlatformTotalCny, 2),
      total_monthly_burn_with_current_8200_cny: money(assumptions.current_baseline_monthly_burn_cny + monthlyPlatformTotalCny, 2),
      estimated_runway_months: money(runway(cashReserveCny, assumptions.current_baseline_monthly_burn_cny, monthlyPlatformTotalCny), 2),
      why_not_linear_with_users: 'The shared DAILY_GLOBAL_LIMIT and DAILY_TOKEN_LIMIT cap the platform before 5/50/100 users can each consume the uncapped high-active plan.'
    };
  });

  const marginal = uncappedDemandPressure.find((item) => item.users === 100) || uncappedDemandPressure[0];
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
    theoretical_worst_case_basis: 'failure_or_concurrency_escape_risk',
    failure_or_concurrency_escape_risk: {
      limit_check_timing: 'Managed Proxy reads accumulated usage before the upstream call and records usage after upstream returns.',
      failed_or_timeout_recording: 'If the upstream request throws before a response body is parsed, chatCompletions returns 502 without recordUsage. Provider-side billing for such attempts cannot be determined from repository evidence.',
      local_proxy_retries: limits.local_model_proxy_max_retries,
      concurrent_requests: 'Concurrent requests can pass pre-call checks against the same historical D1 totals before any of them records usage.',
      conclusion: 'cannot_determine_but_not_fail_closed'
    },
    current_code_reference_limits: assumptions.current_code_reference_limits,
    observed_data: assumptions.observed_data,
    current_enforced_normal_path: currentEnforcedNormalPath,
    uncapped_demand_pressure: uncappedDemandPressure,
    marginal_high_active_user_monthly_model_cost_usd: money(marginalMonthlyModelUsdPerUser),
    marginal_high_active_user_monthly_model_cost_cny: money(marginalMonthlyModelUsdPerUser * usdToCny, 2),
    results: uncappedDemandPressure
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

/**
 * Credit Budget — soft/hard cap on KIE API calls per pipeline run.
 *
 * Why: Without a cap, an iterating user can burn 100+ credits on a single
 * SKU via repeated --skip-slots. This module tracks calls in-process and
 * throws when the hard cap is reached, with warnings at the soft cap.
 *
 * Wiring: kie-client.run() should call CreditBudget.charge() before each
 * actual API call. CLI exposes --max-credits N to override hard cap.
 */
class CreditBudget {
  constructor({ softCap = 40, hardCap = 60, log = console } = {}) {
    this.softCap = softCap;
    this.hardCap = hardCap;
    this.log = log;
    this.count = 0;
    this.byCategory = {};
    this.warned = false;
  }

  charge(category = 'unknown', cost = 1) {
    this.count += cost;
    this.byCategory[category] = (this.byCategory[category] || 0) + cost;

    if (this.count >= this.hardCap) {
      const err = new Error(
        `Credit budget hard cap reached (${this.count}/${this.hardCap}). ` +
        `By category: ${JSON.stringify(this.byCategory)}. ` +
        `Override with --max-credits N if intentional.`
      );
      err.code = 'CREDIT_BUDGET_EXCEEDED';
      throw err;
    }

    if (!this.warned && this.count >= this.softCap) {
      this.warned = true;
      const msg = `[CreditBudget] Soft cap reached: ${this.count}/${this.softCap} calls. Hard cap at ${this.hardCap}.`;
      if (this.log && this.log.warn) this.log.warn(msg); else console.warn(msg);
    }
  }

  summary() {
    return {
      total: this.count,
      softCap: this.softCap,
      hardCap: this.hardCap,
      byCategory: { ...this.byCategory }
    };
  }

  reset() {
    this.count = 0;
    this.byCategory = {};
    this.warned = false;
  }
}

module.exports = { CreditBudget };


/**
 * DEPRECATED: Use shared/dataService.ts for all data operations.
 * This file is kept only for historical reference of static mock logic.
 */
export const dataService = {
  retrieve: () => { 
    console.warn("Call to deprecated services/dataService. Use shared/dataService instead.");
    return { trends: [], articles: [] };
  }
};

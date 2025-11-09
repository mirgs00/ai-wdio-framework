// Auto-generated Page Context Manager
// Manages page objects across different pages in the test flow
import loginPage from './generatedLoginPage';
import dashboardPage from './generatedDashboardPage';
import errorPage from './generatedErrorPage';

class PageContextManager {
  private currentPage: string = 'login';
  private pages: { [key: string]: any } = {
    login: loginPage,
    dashboard: dashboardPage,
    error: errorPage,
  };

  setCurrentPage(pageName: string) {
    if (!this.pages[pageName]) {
      throw new Error(`Unknown page: ${pageName}`);
    }
    this.currentPage = pageName;
  }

  getCurrentPage() {
    return this.pages[this.currentPage];
  }

  getPage(pageName: string) {
    if (!this.pages[pageName]) {
      throw new Error(`Unknown page: ${pageName}`);
    }
    return this.pages[pageName];
  }

  getAllPages() {
    return this.pages;
  }
}

export default new PageContextManager();

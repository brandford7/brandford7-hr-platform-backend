declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        employeeId: string | null;
        roleId: string;
        roleName: string;
        privileges: string[];
        mustChangePassword: boolean;
      };

     
      validated?: {
        body?: unknown;
        params?: Record<string, string>;
        query?: unknown;
      };
    }
  }
}

export {};

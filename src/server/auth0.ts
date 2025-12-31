export const auth0 = {
  async getSession() {
    return null;
  },
  async middleware() {
    throw new Error("Auth0 is disabled. Supabase Auth is used instead.");
  },
};

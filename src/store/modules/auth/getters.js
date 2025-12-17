export default {
  token(state) {
    return state.token;
  },
  userId(state) {
    return state.userId;
  },
  userName(state) {
    return state.userName;
  },
  userEmail(state) {
    return state.userEmail;
  },
  userRole(state) {
    return state.userRole;
  },
  isAuthenticated(state) {
    return !!state.token;
  },
  isAdministrator(state) {
    return state.userRole === 'administrator';
  },
  isEvaluator(state) {
    return state.userRole === 'evaluator';
  },
  tokenExpiration(state) {
    return state.tokenExpiration;
  }
};

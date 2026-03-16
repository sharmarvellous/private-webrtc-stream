import { httpRequest } from "./httpClient.js";

export const authApi = {
  login(credentials) {
    return httpRequest("/auth/login", {
      method: "POST",
      body: credentials
    });
  },
  getMe(accessToken) {
    return httpRequest("/auth/me", { accessToken });
  }
};

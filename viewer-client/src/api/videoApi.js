import { httpRequest } from "./httpClient.js";

export const videoApi = {
  listVideos(accessToken) {
    return httpRequest("/videos", { accessToken });
  },
  getVideo(accessToken, videoId) {
    return httpRequest(`/videos/${videoId}`, { accessToken });
  }
};

import { HttpError } from "../utils/http-error.js";

export class VideoController {
  constructor({ videoRepository }) {
    this.videoRepository = videoRepository;
  }

  listMine = async (req, res) => {
    const videos = await this.videoRepository.findAccessibleByOwner(req.auth.user.id);
    res.json({ videos });
  };

  getById = async (req, res) => {
    const video = await this.videoRepository.findById(req.params.videoId);
    if (!video || video.ownerUserId !== req.auth.user.id) {
      throw new HttpError(404, "Video not found");
    }

    res.json({ video });
  };

  serveProtectedAsset = async (req, res) => {
    const video = await this.videoRepository.findById(req.params.videoId);
    if (!video || video.ownerUserId !== req.auth.user.id) {
      throw new HttpError(404, "Video not found");
    }

    throw new HttpError(
      501,
      "No bundled demo video asset is included. Add a protected MP4 and wire this handler to serve it."
    );
  };
}

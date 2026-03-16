export function VideoPanel({
  title,
  actions,
  videoRef,
  muted = false,
  autoPlay = true,
  playsInline = true,
  controls = true,
  posterText,
  showPoster = true,
  onLoadedData,
  onError
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        {actions ? <div className="button-row">{actions}</div> : null}
      </div>
      <div className="video-frame">
        <video
          ref={videoRef}
          autoPlay={autoPlay}
          muted={muted}
          playsInline={playsInline}
          controls={controls}
          className="video-element"
          onLoadedData={onLoadedData}
          onError={onError}
        />
        {posterText && showPoster ? <div className="video-overlay">{posterText}</div> : null}
      </div>
    </section>
  );
}

type CollagePhoto = {
  id: number
  url: string
  title: string
}

type Props = {
  photos: CollagePhoto[]
}

/** Facebook-style album preview: 1 full / 2 split / 3 hero+stack / 4 grid */
export function FbAlbumCollage({ photos }: Props) {
  const p = photos.slice(0, 4)

  if (p.length === 0) {
    return (
      <div className="fb-album-collage fb-album-collage--empty" aria-hidden>
        <span className="fb-album-placeholder-text">No photos yet</span>
      </div>
    )
  }

  if (p.length === 1) {
    return (
      <div className="fb-album-collage fb-album-collage--1">
        <img src={p[0].url} alt="" className="fb-album-img" loading="lazy" />
      </div>
    )
  }

  if (p.length === 2) {
    return (
      <div className="fb-album-collage fb-album-collage--2">
        {p.map((x) => (
          <img key={x.id} src={x.url} alt="" className="fb-album-img" loading="lazy" />
        ))}
      </div>
    )
  }

  if (p.length === 3) {
    return (
      <div className="fb-album-collage fb-album-collage--3">
        <div className="fb-album-hero">
          <img src={p[0].url} alt="" className="fb-album-img" loading="lazy" />
        </div>
        <div className="fb-album-stack">
          <img src={p[1].url} alt="" className="fb-album-img" loading="lazy" />
          <img src={p[2].url} alt="" className="fb-album-img" loading="lazy" />
        </div>
      </div>
    )
  }

  return (
    <div className="fb-album-collage fb-album-collage--4">
      {p.map((x) => (
        <img key={x.id} src={x.url} alt="" className="fb-album-img" loading="lazy" />
      ))}
    </div>
  )
}

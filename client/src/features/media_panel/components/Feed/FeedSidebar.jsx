import React, { useMemo } from 'react';
import { Users, PlusCircle, PlayCircle } from 'lucide-react';
import './FeedSidebar.css';

export default function FeedSidebar({ projects }) {
  const derivedArtists = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => {
      if (!project?.author) return;
      const id = project.author.id || project.author.username || project.id;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: project.author.username || 'Unknown artist',
          avatar: project.author.avatarUrl,
          stats: `${project.stats?.followers || 0} followers • ${project.stats?.tracks || 1} tracks`,
        });
      }
    });
    return Array.from(map.values()).slice(0, 3);
  }, [projects]);

  const latestProjects = useMemo(() => {
    return projects.slice(0, 5).map((project) => ({
      id: project.id,
      title: project.title,
      artist: project.author?.username || 'Unknown',
      plays: `${project.stats?.views || 0} plays`,
      duration: project.previewAudioDuration || project.preview_audio_duration,
    }));
  }, [projects]);

  return (
    <aside className="feed-sidebar">
      <section className="feed-sidebar__card feed-sidebar__card--cta">
        <div className="feed-sidebar__card-header">
          <div>
            <p className="feed-sidebar__eyebrow">Need a spotlight?</p>
            <h3>Upload your latest track</h3>
            <p className="feed-sidebar__cta-text">
              Share mixes, loops, and stems with the community.
            </p>
          </div>
        </div>
        <button className="feed-sidebar__cta-btn">
          <PlayCircle size={18} />
          Upload track
        </button>
      </section>

      <section className="feed-sidebar__card">
        <div className="feed-sidebar__card-header">
          <div>
            <p className="feed-sidebar__eyebrow">Artists you may like</p>
            <h4>Refresh your inspiration</h4>
          </div>
          <button className="feed-sidebar__text-btn">Refresh</button>
        </div>
        {derivedArtists.length === 0 ? (
          <p className="feed-sidebar__empty">Follow a few creators to see suggestions here.</p>
        ) : (
          <div className="feed-sidebar__list">
            {derivedArtists.map((artist) => (
              <div key={artist.id} className="feed-sidebar__list-item">
                <div className="feed-sidebar__avatar">
                  {artist.avatar ? (
                    <img src={artist.avatar} alt={artist.name} />
                  ) : (
                    <span>{artist.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <strong>{artist.name}</strong>
                  <small>{artist.stats}</small>
                </div>
                <button className="feed-sidebar__pill feed-sidebar__pill--ghost">
                  <Users size={15} />
                  Follow
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="feed-sidebar__card">
        <div className="feed-sidebar__card-header">
          <div>
            <p className="feed-sidebar__eyebrow">Recent likes</p>
            <h4>See what friends love</h4>
          </div>
          <button className="feed-sidebar__text-btn">View all</button>
        </div>
        {latestProjects.length === 0 ? (
          <p className="feed-sidebar__empty">Upload something new and we&apos;ll list it here.</p>
        ) : (
          <div className="feed-sidebar__list feed-sidebar__list--compact">
            {latestProjects.map((item) => (
              <div key={item.id} className="feed-sidebar__list-item feed-sidebar__list-item--compact">
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.artist} • {item.plays}
                  </small>
                </div>
                <PlusCircle size={18} />
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}


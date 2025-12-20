/**
 * Preset Card
 * Individual preset display with download, preview, and rating
 */

import { Download, Star, User, Calendar } from 'lucide-react';
import './PresetCard.css';

export default function PresetCard({ preset, onDownload, onRate }) {
    const {
        id,
        name,
        description,
        presetType,
        engineType,
        category,
        tags,
        downloadsCount,
        ratingAvg,
        ratingCount,
        userName,
        createdAt,
    } = preset;

    const handleDownloadClick = (e) => {
        e.stopPropagation();
        onDownload(id);
    };

    const handleRatingClick = (rating) => {
        onRate(id, rating);
    };

    const formatDate = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    };

    return (
        <div className="preset-card">
            {/* Header */}
            <div className="preset-card-header">
                <div className="preset-card-badges">
                    <div className="preset-card-category">{category}</div>
                    <div className={`preset-card-engine-badge ${presetType}`}>
                        {engineType.toUpperCase()}
                    </div>
                </div>
                <button
                    className="preset-card-download-btn"
                    onClick={handleDownloadClick}
                    title="Download preset"
                >
                    <Download size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="preset-card-content">
                <h3 className="preset-card-name">{name}</h3>
                {description && (
                    <p className="preset-card-description">{description}</p>
                )}

                {/* Tags */}
                {tags && tags.length > 0 && (
                    <div className="preset-card-tags">
                        {tags.slice(0, 3).map(tag => (
                            <span key={tag} className="preset-card-tag">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="preset-card-footer">
                {/* Stats */}
                <div className="preset-card-stats">
                    <div className="preset-card-stat">
                        <Star size={14} fill={ratingAvg ? 'currentColor' : 'none'} />
                        <span>{ratingAvg ? Number(ratingAvg).toFixed(1) : 'N/A'}</span>
                        <span className="preset-card-stat-count">({ratingCount || 0})</span>
                    </div>
                    <div className="preset-card-stat">
                        <Download size={14} />
                        <span>{downloadsCount >= 1000 ? `${(downloadsCount / 1000).toFixed(1)}k` : (downloadsCount || 0)}</span>
                    </div>
                </div>

                {/* Meta */}
                <div className="preset-card-meta">
                    <div className="preset-card-author">
                        <User size={12} />
                        <span>{userName}</span>
                    </div>
                    <div className="preset-card-date">
                        <Calendar size={12} />
                        <span>{formatDate(createdAt)}</span>
                    </div>
                </div>
            </div>

            {/* Rating Stars (hover to rate) */}
            <div className="preset-card-rating">
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        className={`preset-card-star ${star <= Math.round(ratingAvg || 0) ? 'filled' : ''}`}
                        onClick={() => handleRatingClick(star)}
                        title={`Rate ${star} stars`}
                    >
                        <Star size={14} fill={star <= Math.round(ratingAvg || 0) ? 'currentColor' : 'none'} />
                    </button>
                ))}
            </div>
        </div>
    );
}

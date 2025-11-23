/**
 * Project Card Skeleton - Loading placeholder
 */

import React from 'react';
import './ProjectCardSkeleton.css';

export default function ProjectCardSkeleton() {
  return (
    <div className="project-card-skeleton">
      <div className="project-card-skeleton__thumbnail" />
      <div className="project-card-skeleton__content">
        <div className="project-card-skeleton__title" />
        <div className="project-card-skeleton__description" />
        <div className="project-card-skeleton__description" style={{ width: '80%' }} />
        <div className="project-card-skeleton__author" />
        <div className="project-card-skeleton__metadata" />
      </div>
      <div className="project-card-skeleton__actions" />
    </div>
  );
}


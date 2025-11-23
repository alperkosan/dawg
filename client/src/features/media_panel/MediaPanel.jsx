/**
 * Media Panel - Main container for feed, interactions, and notifications
 */

import React, { useState } from 'react';
import { LayoutGrid, Heart, Bell } from 'lucide-react';
import FeedView from './components/Feed/FeedView';
import InteractionsView from './components/Interactions/InteractionsView';
import NotificationsView from './components/Notifications/NotificationsView';
import './MediaPanel.css';

const TABS = {
  FEED: 'feed',
  INTERACTIONS: 'interactions',
  NOTIFICATIONS: 'notifications',
};

export default function MediaPanel() {
  const [activeTab, setActiveTab] = useState(TABS.FEED);

  return (
    <div className="media-panel">
      {/* Tab Navigation */}
      <div className="media-panel__tabs">
        <button
          className={`media-panel__tab ${activeTab === TABS.FEED ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.FEED)}
        >
          <LayoutGrid size={18} />
          <span>Feed</span>
        </button>
        <button
          className={`media-panel__tab ${activeTab === TABS.INTERACTIONS ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.INTERACTIONS)}
        >
          <Heart size={18} />
          <span>Interactions</span>
        </button>
        <button
          className={`media-panel__tab ${activeTab === TABS.NOTIFICATIONS ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.NOTIFICATIONS)}
        >
          <Bell size={18} />
          <span>Notifications</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="media-panel__content">
        {activeTab === TABS.FEED && <FeedView />}
        {activeTab === TABS.INTERACTIONS && <InteractionsView />}
        {activeTab === TABS.NOTIFICATIONS && <NotificationsView />}
      </div>
    </div>
  );
}


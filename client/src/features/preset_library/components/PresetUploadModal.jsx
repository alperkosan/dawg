/**
 * Preset Upload Modal
 * Upload new preset to community library
 */

import { useState, useEffect } from 'react';
import { X, Upload, Tag, Folder } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './PresetUploadModal.css';

export default function PresetUploadModal({ isOpen, onClose, initialData }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: '',
        tags: '',
        genre: '',
    });

    // Pre-fill form when initialData changes
    useEffect(() => {
        if (initialData) {
            console.log('📝 PresetUploadModal - initialData received:', initialData);
            // Form will be submitted with this data
        }
    }, [initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('Please enter a preset name');
            return;
        }

        try {
            const { apiClient } = await import('@/services/api.js');

            // Get auth token
            const { accessToken } = useAuthStore.getState();
            if (!accessToken) {
                apiClient.showToast('Please login to upload presets', 'warning', 3000);
                return;
            }

            // Prepare upload data
            const uploadData = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                presetType: initialData?.presetType || 'instrument',
                engineType: initialData?.engineType || 'zenith',
                category: formData.category || null,
                genre: formData.genre || null,
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
                presetData: initialData?.presetData || {},
                isPublic: true
            };

            console.log('📤 Uploading preset:', uploadData);

            // Upload via apiClient
            const result = await apiClient.uploadPreset(uploadData);
            console.log('✅ Preset uploaded:', result);

            // Success toast is handled by apiClient (if returning message)
            // or we can explicitly show it
            if (!result.message) {
                apiClient.showToast('Preset uploaded to community library!', 'success', 3000);
            }

            // Close modal
            onClose();
        } catch (error) {
            console.error('Failed to upload preset:', error);
            // Error toast is handled by apiClient
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    return (
        <div className="preset-upload-modal-overlay" onClick={onClose}>
            <div className="preset-upload-modal" onClick={(e) => e.stopPropagation()}>
                <div className="preset-upload-modal-header">
                    <h2>
                        <Upload size={20} />
                        Upload Preset
                    </h2>
                    <button onClick={onClose} className="preset-upload-modal-close">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="preset-upload-modal-form">
                    <div className="preset-upload-modal-field">
                        <label htmlFor="name">Preset Name *</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="e.g. Dark Bass"
                        />
                    </div>

                    <div className="preset-upload-modal-field">
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Describe your preset..."
                        />
                    </div>

                    <div className="preset-upload-modal-row">
                        <div className="preset-upload-modal-field">
                            <label htmlFor="category">
                                <Folder size={14} />
                                Category
                            </label>
                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                            >
                                <option value="">Select category</option>
                                {initialData?.presetType === 'effect' ? (
                                    <>
                                        <option value="dynamics">Dynamics</option>
                                        <option value="eq">EQ</option>
                                        <option value="spatial">Spatial (Reverb/Delay)</option>
                                        <option value="modulation">Modulation</option>
                                        <option value="distortion">Distortion/Bitcrush</option>
                                        <option value="utility">Utility</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="bass">Bass</option>
                                        <option value="lead">Lead</option>
                                        <option value="pad">Pad</option>
                                        <option value="fx">FX</option>
                                        <option value="keys">Keys</option>
                                        <option value="drums">Drums/Percussion</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div className="preset-upload-modal-field">
                            <label htmlFor="genre">Genre (Optional)</label>
                            <select
                                id="genre"
                                name="genre"
                                value={formData.genre}
                                onChange={handleChange}
                            >
                                <option value="">Select genre</option>
                                <option value="edm">EDM / Techno</option>
                                <option value="hiphop">Hip-Hop / Trap</option>
                                <option value="ambient">Ambient / Cinematic</option>
                                <option value="rock">Rock / Metal</option>
                                <option value="house">House / Disco</option>
                                <option value="pop">Pop / R&B</option>
                            </select>
                        </div>
                    </div>

                    <div className="preset-upload-modal-field">
                        <label htmlFor="tags">
                            <Tag size={14} />
                            Tags
                        </label>
                        <input
                            type="text"
                            id="tags"
                            name="tags"
                            value={formData.tags}
                            onChange={handleChange}
                            placeholder="dark, aggressive, edm (comma separated)"
                        />
                    </div>

                    <div className="preset-upload-modal-actions">
                        <button type="button" onClick={onClose} className="preset-upload-modal-cancel">
                            Cancel
                        </button>
                        <button type="submit" className="preset-upload-modal-submit">
                            <Upload size={16} />
                            Upload Preset
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

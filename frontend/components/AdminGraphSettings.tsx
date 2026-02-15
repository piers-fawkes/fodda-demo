
import React, { useState, useEffect } from 'react';
import { KnowledgeGraph } from '../../shared/types';
import { dataService } from '../../shared/dataService';

interface AdminGraphSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AdminGraphSettings({ isOpen, onClose }: AdminGraphSettingsProps) {
    const [graphs, setGraphs] = useState<KnowledgeGraph[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingGraph, setEditingGraph] = useState<KnowledgeGraph | null>(null);
    const [formData, setFormData] = useState<Partial<KnowledgeGraph>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadGraphs();
        }
    }, [isOpen]);

    const loadGraphs = async () => {
        setIsLoading(true);
        // In a real app, this might fetch from an API
        // For now, getGraphs returns static data, but we wrap it to simulate async
        try {
            const data = dataService.getGraphs();
            setGraphs(data);
        } catch (e) {
            console.error("Failed to load graphs", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClick = (graph: KnowledgeGraph) => {
        setEditingGraph(graph);
        setFormData({ ...graph });
    };

    const handleSave = async () => {
        if (!editingGraph) return;
        setIsSaving(true);
        // Optimistic update locally
        setGraphs(prev => prev.map(g => g.id === editingGraph.id ? { ...g, ...formData } as KnowledgeGraph : g));

        try {
            // Simulate API call
            console.log("Saving graph updates:", formData);

            // Determine if we have a real endpoint or just mock
            // We'll try to call the new (mocked) endpoint
            const res = await fetch(`/api/admin/graphs/${editingGraph.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                alert("Graph updated! (Note: Persistence is mocked until DB is connected)");
                setEditingGraph(null);
            } else {
                alert("Failed to save changes.");
            }
        } catch (e) {
            console.error("Error saving graph", e);
            alert("Error saving graph");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-black rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-zinc-800 animate-fade-in-up"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/50 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white tracking-tight">Knowledge Graph Management</h2>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="text-center text-zinc-500 py-10">Loading graphs...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 text-left">
                                    <tr>
                                        <th className="px-4 py-3 text-left">ID</th>
                                        <th className="px-4 py-3 text-left">Name</th>
                                        <th className="px-4 py-3 text-left">Owner</th>
                                        <th className="px-4 py-3 text-left">Description</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {graphs.map(graph => (
                                        <tr key={graph.id} className="hover:bg-zinc-900/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-zinc-600">{graph.id}</td>
                                            <td className="px-4 py-3 font-bold text-white">{graph.name}</td>
                                            <td className="px-4 py-3 text-zinc-400">{graph.owner}</td>
                                            <td className="px-4 py-3 text-zinc-500 line-clamp-2 max-w-xs">{graph.description}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleEditClick(graph)}
                                                    className="text-xs font-bold text-fodda-accent hover:text-white uppercase tracking-wider px-3 py-1.5 border border-fodda-accent/30 rounded hover:bg-fodda-accent/10 transition-all"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Edit Modal (Nested) */}
                {editingGraph && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fade-in-up">
                            <h3 className="text-lg font-bold text-white mb-6">Edit Graph Details</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Graph Name</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-white focus:border-fodda-accent focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Owner</label>
                                    <input
                                        type="text"
                                        value={formData.owner || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, owner: e.target.value })}
                                        className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-white focus:border-fodda-accent focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Description</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-white focus:border-fodda-accent focus:outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end space-x-3">
                                <button
                                    onClick={() => setEditingGraph(null)}
                                    className="px-4 py-2 text-zinc-500 hover:text-white font-medium text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-fodda-accent text-white font-bold text-sm rounded-lg hover:bg-fodda-accent/90 transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

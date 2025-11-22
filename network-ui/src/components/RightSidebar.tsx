import { useState, useEffect } from 'react';
import { searchActors, fetchDocument } from '../api';
import type { Relationship, Document, Actor } from '../types';
import DocumentModal from './DocumentModal';

interface RightSidebarProps {
  selectedActor: string | null;
  relationships: Relationship[];
  totalRelationships: number;
  onClose: () => void;
  yearRange: [number, number];
}

export default function RightSidebar({ selectedActor, relationships, totalRelationships, onClose, yearRange }: RightSidebarProps) {
  const [expandedTripleId, setExpandedTripleId] = useState<number | null>(null);
  const [documentToView, setDocumentToView] = useState<string | null>(null);
  const [documentCache, setDocumentCache] = useState<Map<string, Document>>(new Map());
  const [filterActor, setFilterActor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Actor[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  if (!selectedActor) return null;

  // Search functionality
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchActors(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Filter relationships by actor if filterActor is set
  const filteredRelationships = filterActor
    ? relationships.filter(rel =>
        rel.actor === filterActor || rel.target === filterActor
      )
    : relationships;

  // Sort relationships by timestamp
  const sortedRelationships = [...filteredRelationships].sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return a.timestamp.localeCompare(b.timestamp);
  });

  // Fetch document metadata when timeline item is expanded
  useEffect(() => {
    if (expandedTripleId === null) return;

    const rel = sortedRelationships.find(r => r.id === expandedTripleId);
    if (!rel) return;

    // Check if we already have this document in cache
    if (documentCache.has(rel.doc_id)) return;

    // Fetch document metadata using centralized API
    fetchDocument(rel.doc_id)
      .then((doc: Document) => {
        setDocumentCache(prev => new Map(prev).set(rel.doc_id, doc));
      })
      .catch(err => console.error('Failed to fetch document metadata:', err));
  }, [expandedTripleId, sortedRelationships, documentCache]);

  const toggleExpand = (id: number) => {
    setExpandedTripleId(expandedTripleId === id ? null : id);
  };

  return (
    <>
      <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-semibold text-blue-400">Timeline</h2>
                <span className="text-xs text-gray-500">({yearRange[0]} - {yearRange[1]})</span>
              </div>
              <p className="text-sm text-gray-400">{selectedActor}</p>
              <p className="text-xs text-gray-500 mt-1">
                Showing {sortedRelationships.length} of {totalRelationships} relationships
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Filter by Actor */}
          <div className="relative">
            {filterActor ? (
              /* Active Filter Display */
              <div className="flex items-center justify-between bg-blue-900/30 border border-blue-700/50 rounded px-2 py-1">
                <div>
                  <div className="text-xs text-gray-400">Filtered by entity:</div>
                  <div className="text-sm text-blue-300 font-medium">{filterActor}</div>
                </div>
                <button
                  onClick={() => {
                    setFilterActor(null);
                    setSearchQuery('');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Clear
                </button>
              </div>
            ) : (
              <>
                <label className="block text-xs text-gray-400 mb-1">
                  Filter by entity:
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., Donald Trump"
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                />

                {/* Search Results */}
                {searchQuery.trim().length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-40 overflow-y-auto">
                    {isSearching ? (
                      <div className="px-2 py-1 text-xs text-gray-400">
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((actor) => (
                        <button
                          key={actor.name}
                          onClick={() => {
                            setFilterActor(actor.name);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="w-full px-2 py-1 text-left text-xs hover:bg-gray-600 transition-colors border-b border-gray-600 last:border-b-0"
                        >
                          <div className="font-medium text-white">{actor.name}</div>
                          <div className="text-xs text-gray-400">
                            {actor.connection_count} relationships
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-xs text-gray-400">
                        No actors found
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          {sortedRelationships.length === 0 ? (
            <p className="text-gray-500 text-sm p-4">No interactions found</p>
          ) : (
            sortedRelationships.map((rel, index) => (
              <div key={rel.id}>
                {/* Interaction Header - Clickable */}
                <div
                  onClick={() => toggleExpand(rel.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-700/30 transition-colors ${
                    expandedTripleId === rel.id ? 'bg-gray-700/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs text-gray-400">
                      {rel.timestamp || 'No date'}
                    </span>
                    {rel.location && (
                      <span className="text-xs text-gray-500">📍 {rel.location}</span>
                    )}
                  </div>
                  <div className="text-sm flex items-center justify-between">
                    <div>
                      <span className={`font-medium ${rel.actor === selectedActor ? 'text-green-400' : 'text-red-400'}`}>
                        {rel.actor}
                      </span>
                      <span className="text-gray-300 mx-1">{rel.action}</span>
                      <span className={`font-medium ${rel.target === selectedActor ? 'text-green-400' : 'text-red-400'}`}>
                        {rel.target}
                      </span>
                    </div>
                    <span className="text-gray-500 text-xs ml-2">
                      {expandedTripleId === rel.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {/* Expanded Document Info */}
                {expandedTripleId === rel.id && (
                  <div className="px-4 pb-4 bg-gray-700/10">
                    <div className="text-xs text-gray-400 mb-2">Source Document</div>
                    <button
                      onClick={() => setDocumentToView(rel.doc_id)}
                      className="text-left w-full p-3 bg-gray-700/50 hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="text-sm font-medium text-blue-400 mb-1">
                        {rel.doc_id}
                      </div>
                      {documentCache.has(rel.doc_id) ? (
                        <>
                          <div className="text-xs text-gray-300 mb-2 mt-2 italic">
                            {documentCache.get(rel.doc_id)!.one_sentence_summary}
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Click to view full document
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Loading summary...
                        </div>
                      )}
                    </button>
                  </div>
                )}

                {/* Separator */}
                {index < sortedRelationships.length - 1 && (
                  <div className="border-b border-gray-700" />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Document Modal */}
      {documentToView && (() => {
        const rel = sortedRelationships.find(r => r.doc_id === documentToView);
        return rel ? (
          <DocumentModal
            docId={documentToView}
            highlightTerm={selectedActor}
            secondaryHighlightTerm={
              rel.actor === selectedActor
                ? rel.target
                : rel.actor
            }
            onClose={() => setDocumentToView(null)}
          />
        ) : null;
      })()}
    </>
  );
}

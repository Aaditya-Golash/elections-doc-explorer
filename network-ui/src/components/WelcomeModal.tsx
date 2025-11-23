import React from 'react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-white">
            Welcome to the Epstein Document Network Explorer
          </h2>

          <div className="space-y-4 text-gray-300">
            <p>
              This is a network analysis tool for exploring relationships between people, places,
              and events captured in the Epstein emails released by the House Oversight Committee.
            </p>

            <p>
              LLMs were used to extract these relationships from the raw document text, and as such,
              it is likely that there are some errors and omissions.
            </p>

            <p>
              Click on a relationship in the timeline after selecting or searching for a specific
              actor to see the document it was taken from with the principals highlighted. You can
              verify for yourself if the relationship is accurate according to the document.
            </p>

            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 mt-6">
              <h3 className="font-semibold text-blue-400 mb-2">How to use:</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300">
                <li>Search for actors using the search bar</li>
                <li>Click on nodes in the graph to explore their relationships</li>
                <li>Use filters to focus on specific content categories</li>
                <li>Click document links in the timeline to view source documents</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                       transition-colors font-medium"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

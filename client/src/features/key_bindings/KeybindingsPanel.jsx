import React from 'react';
import { keymap } from '../../config/keymapConfig'; // Merkezi yapılandırmayı import et

/**
 * keymapConfig.js dosyasını okuyarak tüm klavye kısayollarını
 * kategorize edilmiş bir şekilde gösteren panel.
 */
function KeybindingsPanel() {
  return (
    <div className="w-full h-full p-4 bg-gray-800 text-white overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 text-cyan-400">Klavye Kısayolları</h2>
      <div className="space-y-6">
        {Object.values(keymap).map((category) => (
          <div key={category.name}>
            <h3 className="text-lg font-bold mb-2 border-b-2 border-gray-700 pb-1">{category.name}</h3>
            <table className="w-full text-sm">
              <tbody>
                {Object.values(category.bindings).map((binding) => (
                  <tr key={binding.name} className="border-b border-gray-700/50">
                    <td className="py-2 pr-4">{binding.name}</td>
                    <td className="py-2 text-right">
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-300 bg-gray-900 border border-gray-700 rounded-md">
                        {binding.default}
                      </kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

export default KeybindingsPanel;

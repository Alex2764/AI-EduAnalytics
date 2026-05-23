import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { supabase } from '../../lib/supabase';
import { buildTestLinkEntries, type TestLinkEntry } from '../../utils/testLinks';
import { logger } from '../../utils/logger';
import type { Test } from '../../types';

interface TestLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test | null;
}

export const TestLinkModal: React.FC<TestLinkModalProps> = ({
  isOpen,
  onClose,
  test,
}) => {
  const [links, setLinks] = useState<TestLinkEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !test) {
      setLinks([]);
      setError('');
      setCopiedKey(null);
      return;
    }

    let cancelled = false;

    const loadTokens = async () => {
      setLoading(true);
      setError('');
      setLinks([]);

      try {
        const { data, error: fetchError } = await supabase
          .from('test_tokens')
          .select('group_number, token')
          .eq('test_id', test.id)
          .order('group_number', { ascending: true });

        if (fetchError) throw fetchError;
        if (cancelled) return;

        const rows = data ?? [];
        if (rows.length === 0) {
          setError('Няма генерирани линкове за този тест.');
          return;
        }

        setLinks(buildTestLinkEntries(rows, test.hasGroups));
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Грешка при зареждане на линковете.';
        logger.error('Error loading test tokens:', err);
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTokens();

    return () => {
      cancelled = true;
    };
  }, [isOpen, test?.id, test?.hasGroups]);

  const handleCopy = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      logger.error('Грешка при копиране на линк:', err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={test ? `Линк — ${test.name}` : 'Линк за тест'}
      size="md"
    >
      <div className="modal-body">
        {loading && (
          <p className="text-sm text-gray-600 text-center py-4">Зареждане на линкове...</p>
        )}

        {!loading && error && (
          <p className="text-sm text-red-600 text-center py-2">{error}</p>
        )}

        {!loading && !error && links.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Споделете който и да е от линковете — ученикът въвежда имената си и системата
              определя I/II група по номера в списъка (нечетен → I, четен → II). Двата линка
              са за същия тест; различават се само въпросите по група.
            </p>
            {links.map(entry => {
              const copyKey = String(entry.groupNumber);
              const isCopied = copiedKey === copyKey;

              return (
                <div key={entry.groupNumber} className="space-y-2">
                  {entry.label && (
                    <p className="text-sm font-semibold text-gray-800">{entry.label}</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={entry.url}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-800"
                      onFocus={e => e.target.select()}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs py-2 px-4 whitespace-nowrap"
                      onClick={() => handleCopy(copyKey, entry.url)}
                    >
                      {isCopied ? 'Копирано!' : 'Копирай'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={onClose}>
            Затвори
          </Button>
        </div>
      </div>
    </Modal>
  );
};

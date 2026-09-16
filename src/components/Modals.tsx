import React, { useState, useEffect } from 'react';
import { X, ClipboardList, FolderPlus, Edit3, Trash2 } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) setName('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111120] border border-[#1e1e35] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#00e5ff]">
            <FolderPlus size={18} />
            <h3 className="font-semibold text-base text-[#e8e8f0]">
              Новый проект
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#555570] hover:text-[#e8e8f0] p-1 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-[#8a8aa3] leading-relaxed">
          Создайте новое смысловое пространство для анализа тем, бренд-стратегий,
          терминов или контент-планов.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Стратегия Q3, Архитектура метавселенной..."
            maxLength={60}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0b13] border border-[#1e1e35] text-xs text-[#e8e8f0] focus:outline-none focus:border-[#00e5ff] placeholder-[#555570]"
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#1e1e35] text-xs text-[#8a8aa3] hover:text-[#e8e8f0] hover:border-[#2a2a4a] transition-all cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#b478ff] text-[#07070c] font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all cursor-pointer"
            >
              Создать проект
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RenameProjectModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}

export const RenameProjectModal: React.FC<RenameProjectModalProps> = ({
  isOpen,
  currentName,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onRename(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111120] border border-[#1e1e35] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#00e5ff]">
            <Edit3 size={18} />
            <h3 className="font-semibold text-base text-[#e8e8f0]">
              Переименовать проект
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#555570] hover:text-[#e8e8f0] p-1 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0b13] border border-[#1e1e35] text-xs text-[#e8e8f0] focus:outline-none focus:border-[#00e5ff]"
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#1e1e35] text-xs text-[#8a8aa3] hover:text-[#e8e8f0] transition-all cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#b478ff] text-[#07070c] font-semibold text-xs disabled:opacity-40 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all cursor-pointer"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteProjectModalProps {
  isOpen: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  projectName,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#111120] border border-[#1e1e35] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-[#ff6b9d]">
          <Trash2 size={18} />
          <h3 className="font-semibold text-base text-[#e8e8f0]">
            Удалить проект?
          </h3>
        </div>

        <p className="text-xs text-[#8a8aa3] leading-relaxed">
          Проект <strong className="text-[#e8e8f0]">«{projectName}»</strong> и
          все его концепты будут безвозвратно удалены.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#1e1e35] text-xs text-[#8a8aa3] hover:text-[#e8e8f0] transition-all cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff6b9d] to-[#b478ff] text-[#07070c] font-semibold text-xs hover:shadow-[0_0_15px_rgba(255,107,157,0.3)] transition-all cursor-pointer"
          >
            Удалить проект
          </button>
        </div>
      </div>
    </div>
  );
};

interface BatchPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (concepts: string[], replace: boolean) => void;
}

export const BatchPasteModal: React.FC<BatchPasteModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [text, setText] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);

  useEffect(() => {
    if (isOpen) setText('');
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedItems = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedItems.length) return;
    onImport(parsedItems, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#111120] border border-[#1e1e35] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#00e5ff]">
            <ClipboardList size={18} />
            <h3 className="font-semibold text-base text-[#e8e8f0]">
              Вставить список концептов
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#555570] hover:text-[#e8e8f0] p-1 rounded transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-[#8a8aa3] leading-relaxed">
          Вставьте список терминов или идей — каждый с новой строки или через запятую.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            autoFocus
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Скорость\nНадежность\nИнновация\nСвобода\nКачество\n...'}
            className="w-full p-3.5 rounded-xl bg-[#0b0b13] border border-[#1e1e35] text-xs text-[#e8e8f0] mono focus:outline-none focus:border-[#00e5ff] placeholder-[#555570] resize-y"
          />

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-[#8a8aa3] cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded accent-[#00e5ff]"
              />
              <span>Заменить текущие концепты (иначе добавить к ним)</span>
            </label>

            <span className="mono text-[11px] text-[#00e5ff]">
              Распознано: {parsedItems.length}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#1e1e35] text-xs text-[#8a8aa3] hover:text-[#e8e8f0] transition-all cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={parsedItems.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#b478ff] text-[#07070c] font-semibold text-xs disabled:opacity-40 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all cursor-pointer"
            >
              Импортировать ({parsedItems.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

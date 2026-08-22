import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, FileText, Check } from 'lucide-react';
import { Task, CustomFieldValue } from '../types.ts';

interface TaskCompletionModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirmComplete: (taskId: string, filledValues: CustomFieldValue[]) => void;
}

export default function TaskCompletionModal({
  isOpen,
  task,
  onClose,
  onConfirmComplete,
}: TaskCompletionModalProps) {
  if (!isOpen || !task) return null;

  // Inicializar estado dos valores customizados com os valores prévios ou vazios
  const [formValues, setFormValues] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {};
    task.customFields?.forEach((field) => {
      const existing = task.customFieldValues?.find((v) => v.fieldId === field.id);
      initial[field.id] = existing !== undefined ? existing.value : '';
    });
    return initial;
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleInputChange = (fieldId: string, value: string, type: 'text' | 'number') => {
    setValidationError(null);
    if (type === 'number') {
      const parsed = value === '' ? '' : Number(value);
      setFormValues((prev) => ({ ...prev, [fieldId]: parsed }));
    } else {
      setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validar se todos os campos obrigatórios foram preenchidos
    const missingFields: string[] = [];
    const filledValues: CustomFieldValue[] = [];

    task.customFields?.forEach((field) => {
      const val = formValues[field.id];
      if (field.required) {
        if (val === undefined || val === null || val === '') {
          missingFields.push(field.label);
        }
      }
      if (val !== undefined && val !== null && val !== '') {
        filledValues.push({
          fieldId: field.id,
          value: val,
        });
      }
    });

    if (missingFields.length > 0) {
      setValidationError(
        `Preencha obrigatoriamente: ${missingFields.join(', ')} para concluir a ação.`
      );
      return;
    }

    onConfirmComplete(task.id, filledValues);
    onClose();
  };

  return (
    <div
      id="completion-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="completion-modal-card"
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-gray-200 bg-emerald-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Concluir Ação Obrigatória
              </h3>
              <p className="text-[11px] text-gray-500 truncate max-w-[260px]">
                {task.title}
              </p>
            </div>
          </div>
        </div>

        {/* Formulário com Campos Customizados */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              O administrador configurou métricas/campos obrigatórios que devem ser preenchidos antes de marcar esta ação como <strong>Concluída</strong>.
            </p>
          </div>

          {validationError && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="space-y-3.5 pt-1">
            {task.customFields && task.customFields.length > 0 ? (
              task.customFields.map((field) => {
                const currentValue = formValues[field.id] !== undefined ? formValues[field.id] : '';

                return (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      required={field.required}
                      placeholder={
                        field.placeholder ||
                        (field.type === 'number' ? '0' : 'Digite a resposta...')
                      }
                      value={currentValue}
                      onChange={(e) =>
                        handleInputChange(field.id, e.target.value, field.type)
                      }
                      className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 bg-white"
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-500 italic">
                Nenhum campo adicional necessário.
              </p>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Salvar e Concluir</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

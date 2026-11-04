// Turns questions written in the admin ("Form questions" and "Client forms") into form fields.
export const QUESTION_TYPES = {
  'Short answer': 'text',
  'Long answer': 'textarea',
  'Date': 'date',
  'Yes / No': 'yesno',
  'Choice list': 'select',
  'Number': 'number',
  'Email address': 'email',
  'Phone number': 'tel',
  'Country': 'country',
};

export function customStep(def, id = 'custom') {
  const fields = (def?.questions || [])
    .filter((q) => q && q.label && q.label.trim())
    .map((q, i) => {
      let type = QUESTION_TYPES[q.type] || 'text';
      const options = type === 'select' ? String(q.options || '').split(/\n|,/).map((x) => x.trim()).filter(Boolean) : undefined;
      if (type === 'select' && !options.length) type = 'text';
      return { name: `${id}_${i + 1}`, label: q.label.trim(), type, required: !!q.required, ...(q.hint ? { hint: q.hint } : {}), ...(options && options.length ? { options } : {}) };
    });
  if (!fields.length) return null;
  return { id, title: def.title || 'Additional questions', ...(def.intro ? { intro: def.intro } : {}), shared: !!def.askOnce, fields };
}

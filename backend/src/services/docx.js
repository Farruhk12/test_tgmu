import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { questionToSymbolLines } from './questionFormat.js';

const DOCX_LANG_SECTION = {
  ru: 'Все вопросы на русском языке',
  tj: 'Все вопросы на таджикском языке',
  en: 'Все вопросы на английском языке',
};

function appendTitleCentered(children, title) {
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, bold: true })],
    })
  );
}

function appendMetaCentered(children, meta) {
  if (!meta) return;
  const lines = [
    meta.faculty && `Факультет: ${meta.faculty}`,
    meta.course && `Курс: ${meta.course}`,
    meta.department && `Кафедра: ${meta.department}`,
    meta.subject && `Предмет: ${meta.subject}`,
  ].filter(Boolean);

  for (const line of lines) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: line })],
      })
    );
  }
}

function appendLangHeadingIfChanged(children, lang, prevHolder) {
  if (!lang || !DOCX_LANG_SECTION[lang]) return;
  if (prevHolder.v === lang) return;
  prevHolder.v = lang;
  children.push(new Paragraph({ text: '' }));
  children.push(
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: DOCX_LANG_SECTION[lang],
          bold: true,
          size: 26,
        }),
      ],
    })
  );
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {{ questions: object[], meta?: object }} opts.test
 * @param {'symbol' | 'classic'} [opts.format='symbol']
 */
export async function buildDocx({ title, test, format = 'symbol' }) {
  if (format === 'classic') {
    return buildDocxClassic({ title, test });
  }
  return buildDocxSymbol({ title, test });
}

async function buildDocxSymbol({ title, test }) {
  const { questions, meta } = test;
  const children = [];

  appendTitleCentered(children, title);
  appendMetaCentered(children, meta);
  children.push(new Paragraph({ text: '' }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Формат строк: @ — текст вопроса; # — неверный вариант; #& — верный вариант (без пробела после символов).',
          italics: true,
          size: 20,
        }),
      ],
    })
  );
  children.push(new Paragraph({ text: '' }));

  const langHead = { v: null };
  questions.forEach((q) => {
    appendLangHeadingIfChanged(children, q._outputLang, langHead);
    const lines = questionToSymbolLines(q);
    lines.forEach((line, lineIdx) => {
      children.push(
        new Paragraph({
          spacing: { before: lineIdx === 0 ? 240 : 0, after: 40 },
          children: [
            new TextRun({
              text: line,
              font: 'Consolas',
            }),
          ],
        })
      );
    });
  });

  children.push(
    new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Ключ (верные ответы)', bold: true })],
    })
  );

  const keyLangHead = { v: null };
  questions.forEach((q) => {
    appendLangHeadingIfChanged(children, q._outputLang, keyLangHead);
    const correct = q.correct;
    const txt = q.options?.[correct] || '—';
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [
          new TextRun({ text: `${correct}) ${txt}`, font: 'Consolas' }),
          q.explanation
            ? new TextRun({ text: `  — ${q.explanation}`, italics: true })
            : new TextRun({ text: '' }),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return await Packer.toBuffer(doc);
}

async function buildDocxClassic({ title, test }) {
  const { questions, meta } = test;

  const children = [];

  appendTitleCentered(children, title);
  appendMetaCentered(children, meta);
  children.push(new Paragraph({ text: '' }));

  let n = 0;
  const langHead = { v: null };
  questions.forEach((q) => {
    appendLangHeadingIfChanged(children, q._outputLang, langHead);
    n += 1;
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({ text: `${n}. `, bold: true }),
          new TextRun({ text: q.question }),
        ],
      })
    );

    for (const letter of ['A', 'B', 'C', 'D']) {
      if (q.options && q.options[letter]) {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            children: [new TextRun({ text: `${letter}) ${q.options[letter]}` })],
          })
        );
      }
    }
  });

  children.push(
    new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Ключ ответов', bold: true })],
    })
  );

  let k = 0;
  const keyLangHead = { v: null };
  questions.forEach((q) => {
    appendLangHeadingIfChanged(children, q._outputLang, keyLangHead);
    k += 1;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${k}. `, bold: true }),
          new TextRun({ text: q.correct || '—', bold: true }),
          q.explanation
            ? new TextRun({ text: `  — ${q.explanation}`, italics: true })
            : new TextRun({ text: '' }),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return await Packer.toBuffer(doc);
}

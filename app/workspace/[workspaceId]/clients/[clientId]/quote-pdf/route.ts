import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { z } from "zod";

function toMoneyDecimal(value: number): string {
  return value.toFixed(2);
}

function parseIssueDate(input: string): Date {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function buildQuoteNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-7);
  const rand = Math.floor(Math.random() * 900 + 100).toString();
  return `DEV-${year}-${timestamp}-${rand}`;
}

const quotePayloadSchema = z.object({
  creator: z.object({
    name: z.string().trim().min(1, "Le nom est requis."),
    email: z.string().trim().email("Email invalide."),
    phone: z.string().trim().min(1, "Le numero de telephone est requis."),
    siret: z.string().trim().min(1, "Le SIRET est requis."),
  }),
  createdAt: z.string().trim().min(1),
  needSummary: z.string().trim().min(1, "Le resume du besoin est requis."),
  sitePages: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
      }),
    )
    .max(60),
  features: z.array(z.string().trim().min(1)).max(80),
  technicalDescription: z
    .string()
    .trim()
    .min(1, "La description technique est requise."),
  planning: z.string().trim().min(1, "Le planning est requis."),
  paymentTerms: z
    .string()
    .trim()
    .min(1, "Les modalites de paiement sont requises."),
  maintenance: z.object({
    description: z.string().trim().min(1),
  }),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        priceHt: z.number().finite().min(0),
      }),
    )
    .min(1, "Ajoute au moins un item de devis."),
});

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 46;

function normalizeDate(dateInput: string): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("fr-FR").format(new Date());
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${currentLine} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }

  lines.push(currentLine);
  return lines;
}

async function buildQuotePdf(params: {
  quoteNumber: string;
  clientLabel: string;
  createdAt: string;
  creator: {
    name: string;
    email: string;
    phone: string;
    siret: string;
  };
  needSummary: string;
  sitePages: Array<{ title: string; description: string }>;
  features: string[];
  technicalDescription: string;
  planning: string;
  paymentTerms: string;
  maintenance: {
    description: string;
  };
  items: Array<{ label: string; priceHt: number }>;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let fontRegular: PDFFont;
  let fontBold: PDFFont;

  try {
    const urbanistPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "Urbanist-VariableFont_wght.ttf",
    );
    const quicksandPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "Quicksand-VariableFont_wght.ttf",
    );

    const [urbanistBytes, quicksandBytes] = await Promise.all([
      readFile(urbanistPath),
      readFile(quicksandPath),
    ]);

    fontBold = await pdfDoc.embedFont(urbanistBytes);
    fontRegular = await pdfDoc.embedFont(quicksandBytes);
  } catch {
    // Fallback pour ne jamais bloquer la generation PDF.
    fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;

  const contentWidth = A4_WIDTH - MARGIN * 2;
  const palette = {
    text: rgb(0.12, 0.12, 0.13),
    muted: rgb(0.4, 0.4, 0.42),
    border: rgb(0.82, 0.82, 0.84),
    accent: rgb(0.08, 0.08, 0.09),
    accentSoft: rgb(0.94, 0.94, 0.95),
    surface: rgb(0.99, 0.99, 0.995),
  };

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight < MARGIN) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      y = A4_HEIGHT - MARGIN;
    }
  };

  const startNewPage = () => {
    page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    y = A4_HEIGHT - MARGIN;
  };

  const drawLine = (text: string, size = 10, bold = false) => {
    ensureSpace(size + 10);
    page.drawText(text, {
      x: MARGIN,
      y,
      size,
      font: bold ? fontBold : fontRegular,
      color: palette.text,
    });
    y -= size + 10;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(28);
    page.drawText(title, {
      x: MARGIN,
      y,
      size: 13,
      font: fontBold,
      color: palette.accent,
    });
    y -= 14;
    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: A4_WIDTH - MARGIN, y: y + 2 },
      thickness: 0.7,
      color: palette.border,
    });
    y -= 12;
  };

  const drawParagraph = (text: string) => {
    const chunks = splitLines(text);
    if (chunks.length === 0) {
      drawLine("-");
      return;
    }

    for (const chunk of chunks) {
      const lines = wrapText(chunk, fontRegular, 10, contentWidth);
      for (const line of lines) {
        drawLine(line, 10, false);
      }
      y -= 3;
    }
  };

  const drawBulletList = (entries: string[]) => {
    if (entries.length === 0) {
      drawLine("-", 10, false);
      return;
    }

    for (const entry of entries) {
      const bulletPrefix = "• ";
      const firstLineMax = contentWidth - 12;
      const wrapped = wrapText(entry, fontRegular, 10, firstLineMax);

      ensureSpace(wrapped.length * 16);

      for (let idx = 0; idx < wrapped.length; idx += 1) {
        const line = wrapped[idx];
        const text = idx === 0 ? `${bulletPrefix}${line}` : `  ${line}`;
        page.drawText(text, {
          x: MARGIN,
          y,
          size: 10,
          font: fontRegular,
          color: palette.text,
        });
        y -= 17;
      }
      y -= 5;
    }
  };

  const estimateParagraphHeight = (text: string) => {
    const chunks = splitLines(text);
    if (chunks.length === 0) return 20;

    return chunks.reduce((total, chunk) => {
      const lines = wrapText(chunk, fontRegular, 10, contentWidth).length;
      return total + Math.max(1, lines) * 20 + 3;
    }, 0);
  };

  const estimateBulletListHeight = (entries: string[]) => {
    if (entries.length === 0) return 20;

    return entries.reduce((total, entry) => {
      const lines = wrapText(entry, fontRegular, 10, contentWidth - 12).length;
      return total + Math.max(1, lines) * 17 + 5;
    }, 0);
  };

  const estimateSitePagesTableHeight = (
    entries: Array<{ title: string; description: string }>,
  ) => {
    if (entries.length === 0) return 20;

    const titleColWidth = 150;
    const descColWidth = contentWidth - titleColWidth;
    const rowsHeight = entries.reduce((total, entry) => {
      const titleLines = wrapText(
        entry.title,
        fontBold,
        9.5,
        titleColWidth - 12,
      );
      const descriptionLines = wrapText(
        entry.description,
        fontRegular,
        9.5,
        descColWidth - 12,
      );
      const lineCount = Math.max(titleLines.length, descriptionLines.length);
      const rowHeight = Math.max(28, lineCount * 13 + 8);
      return total + rowHeight;
    }, 0);

    return 24 + rowsHeight + 8;
  };

  const drawProviderCard = (creator: {
    name: string;
    email: string;
    phone: string;
    siret: string;
  }) => {
    const cardHeight = 102;
    ensureSpace(cardHeight + 10);

    page.drawRectangle({
      x: MARGIN,
      y: y - cardHeight,
      width: contentWidth,
      height: cardHeight,
      color: rgb(1, 1, 1),
      borderColor: palette.border,
      borderWidth: 0.9,
    });
    page.drawRectangle({
      x: MARGIN,
      y: y - 24,
      width: contentWidth,
      height: 24,
      color: palette.accent,
    });
    page.drawText("INFORMATIONS PRESTATAIRE", {
      x: MARGIN + 10,
      y: y - 16,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const leftX = MARGIN + 12;
    const rightX = MARGIN + contentWidth / 2 + 6;
    const firstRowY = y - 44;
    const secondRowY = y - 72;

    page.drawText(`Nom: ${creator.name}`, {
      x: leftX,
      y: firstRowY,
      size: 10,
      font: fontRegular,
      color: palette.text,
      maxWidth: contentWidth / 2 - 18,
    });
    page.drawText(`SIRET: ${creator.siret}`, {
      x: rightX,
      y: firstRowY,
      size: 10,
      font: fontRegular,
      color: palette.text,
      maxWidth: contentWidth / 2 - 18,
    });
    page.drawText(`Email: ${creator.email}`, {
      x: leftX,
      y: secondRowY,
      size: 10,
      font: fontRegular,
      color: palette.text,
      maxWidth: contentWidth / 2 - 18,
    });
    page.drawText(`Telephone: ${creator.phone}`, {
      x: rightX,
      y: secondRowY,
      size: 10,
      font: fontRegular,
      color: palette.text,
      maxWidth: contentWidth / 2 - 18,
    });

    y -= cardHeight + 14;
  };

  const drawSitePagesTable = (
    entries: Array<{ title: string; description: string }>,
  ) => {
    if (entries.length === 0) {
      drawLine("-");
      return;
    }

    const titleColWidth = 150;
    const descColWidth = contentWidth - titleColWidth;
    const headerHeight = 24;

    const drawTableHeader = () => {
      ensureSpace(headerHeight + 8);
      page.drawRectangle({
        x: MARGIN,
        y: y - headerHeight,
        width: contentWidth,
        height: headerHeight,
        color: palette.accent,
      });
      page.drawLine({
        start: { x: MARGIN + titleColWidth, y: y },
        end: { x: MARGIN + titleColWidth, y: y - headerHeight },
        thickness: 0.8,
        color: palette.border,
      });
      page.drawText("PAGE", {
        x: MARGIN + 8,
        y: y - 15,
        size: 10,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      page.drawText("DESCRIPTION", {
        x: MARGIN + titleColWidth + 8,
        y: y - 15,
        size: 10,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      y -= headerHeight;
    };

    drawTableHeader();

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const titleLines = wrapText(
        entry.title,
        fontBold,
        9.5,
        titleColWidth - 12,
      );
      const descriptionLines = wrapText(
        entry.description,
        fontRegular,
        9.5,
        descColWidth - 12,
      );
      const lineCount = Math.max(titleLines.length, descriptionLines.length);
      const rowHeight = Math.max(28, lineCount * 13 + 8);

      if (y - rowHeight < MARGIN) {
        page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        y = A4_HEIGHT - MARGIN;
        drawTableHeader();
      }

      if (index % 2 === 0) {
        page.drawRectangle({
          x: MARGIN,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: palette.surface,
        });
      }
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        borderColor: palette.border,
        borderWidth: 0.6,
      });
      page.drawLine({
        start: { x: MARGIN + titleColWidth, y },
        end: { x: MARGIN + titleColWidth, y: y - rowHeight },
        thickness: 0.6,
        color: palette.border,
      });

      for (let i = 0; i < titleLines.length; i += 1) {
        page.drawText(titleLines[i], {
          x: MARGIN + 8,
          y: y - 14 - i * 13,
          size: 9.5,
          font: fontBold,
          color: palette.text,
        });
      }
      for (let i = 0; i < descriptionLines.length; i += 1) {
        page.drawText(descriptionLines[i], {
          x: MARGIN + titleColWidth + 8,
          y: y - 14 - i * 13,
          size: 9.5,
          font: fontRegular,
          color: palette.text,
        });
      }

      y -= rowHeight;
    }

    y -= 8;
  };

  const drawFinancialTable = (
    entries: Array<{ label: string; priceHt: number }>,
  ) => {
    if (entries.length === 0) {
      drawLine("-");
      return;
    }

    const labelColWidth = contentWidth - 130;
    const priceColWidth = contentWidth - labelColWidth;
    const headerHeight = 24;

    const drawTableHeader = () => {
      ensureSpace(headerHeight + 8);
      page.drawRectangle({
        x: MARGIN,
        y: y - headerHeight,
        width: contentWidth,
        height: headerHeight,
        color: palette.accent,
      });
      page.drawLine({
        start: { x: MARGIN + labelColWidth, y },
        end: { x: MARGIN + labelColWidth, y: y - headerHeight },
        thickness: 0.8,
        color: palette.border,
      });
      page.drawText("ITEM", {
        x: MARGIN + 8,
        y: y - 15,
        size: 10,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      page.drawText("PRIX HT", {
        x: MARGIN + labelColWidth + 8,
        y: y - 15,
        size: 10,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      y -= headerHeight;
    };

    drawTableHeader();

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const labelLines = wrapText(
        entry.label,
        fontRegular,
        9.5,
        labelColWidth - 12,
      );
      const priceText = formatMoney(entry.priceHt);
      const priceLines = wrapText(priceText, fontBold, 9.5, priceColWidth - 12);
      const lineCount = Math.max(labelLines.length, priceLines.length);
      const rowHeight = Math.max(28, lineCount * 13 + 8);

      if (y - rowHeight < MARGIN) {
        page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        y = A4_HEIGHT - MARGIN;
        drawTableHeader();
      }

      if (index % 2 === 0) {
        page.drawRectangle({
          x: MARGIN,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: palette.surface,
        });
      }
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        borderColor: palette.border,
        borderWidth: 0.6,
      });
      page.drawLine({
        start: { x: MARGIN + labelColWidth, y },
        end: { x: MARGIN + labelColWidth, y: y - rowHeight },
        thickness: 0.6,
        color: palette.border,
      });

      for (let i = 0; i < labelLines.length; i += 1) {
        page.drawText(labelLines[i], {
          x: MARGIN + 8,
          y: y - 14 - i * 13,
          size: 9.5,
          font: fontRegular,
          color: palette.text,
        });
      }
      for (let i = 0; i < priceLines.length; i += 1) {
        page.drawText(priceLines[i], {
          x: MARGIN + labelColWidth + 8,
          y: y - 14 - i * 13,
          size: 9.5,
          font: fontBold,
          color: palette.text,
        });
      }

      y -= rowHeight;
    }

    y -= 8;
  };

  let embeddedLogo: Awaited<ReturnType<typeof pdfDoc.embedPng>> | undefined;

  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "logo",
      "Logo_inTheGleam_Black.png",
    );
    const logoBytes = await readFile(logoPath);
    embeddedLogo = await pdfDoc.embedPng(logoBytes);
  } catch {
    // Logo non bloquant.
  }

  const headerHeight = 122;
  ensureSpace(headerHeight + 8);

  page.drawRectangle({
    x: MARGIN,
    y: y - headerHeight + 8,
    width: contentWidth,
    height: headerHeight,
    color: rgb(1, 1, 1),
    borderColor: palette.border,
    borderWidth: 0.8,
  });

  const topBandHeight = 44;
  page.drawRectangle({
    x: MARGIN,
    y: y - topBandHeight + 8,
    width: contentWidth,
    height: topBandHeight,
    color: palette.accent,
  });

  const logoPanelWidth = 108;
  page.drawRectangle({
    x: MARGIN + 10,
    y: y - headerHeight + 18,
    width: logoPanelWidth,
    height: headerHeight - 22,
    color: rgb(1, 1, 1),
    borderColor: palette.border,
    borderWidth: 0.8,
  });

  page.drawText("DEVIS", {
    x: MARGIN + 132,
    y: y - 23,
    size: 27,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`N° ${params.quoteNumber}`, {
    x: MARGIN + 132,
    y: y - 68,
    size: 10,
    font: fontBold,
    color: palette.text,
  });
  page.drawText(`Date: ${normalizeDate(params.createdAt)}`, {
    x: MARGIN + 132,
    y: y - 84,
    size: 10,
    font: fontRegular,
    color: palette.text,
  });
  page.drawText(`Entreprise cliente: ${params.clientLabel}`, {
    x: MARGIN + 132,
    y: y - 100,
    size: 10,
    font: fontRegular,
    color: palette.text,
  });

  if (embeddedLogo) {
    const ratio = embeddedLogo.width / embeddedLogo.height;
    const logoWidth = 90;
    const logoHeight = logoWidth / ratio;
    const maxHeight = headerHeight - 38;
    const finalHeight = Math.min(logoHeight, maxHeight);
    const finalWidth = finalHeight * ratio;
    page.drawImage(embeddedLogo, {
      x: MARGIN + 10 + (logoPanelWidth - finalWidth) / 2,
      y: y - headerHeight + 28,
      width: finalWidth,
      height: finalHeight,
    });
  }

  y -= headerHeight + 8;
  drawProviderCard(params.creator);

  const sectionTopSpacing = 14;
  const sectionBlockOverhead = 28;

  y -= sectionTopSpacing;
  const resumeBlockHeight =
    sectionBlockOverhead + estimateParagraphHeight(params.needSummary);
  const remainingBeforeResume = y - MARGIN;
  if (resumeBlockHeight > remainingBeforeResume) {
    startNewPage();
  }
  drawSectionTitle("Resume du besoin");
  drawParagraph(params.needSummary);

  y -= sectionTopSpacing;
  const sitePagesBlockHeight =
    sectionBlockOverhead + estimateSitePagesTableHeight(params.sitePages);
  const remainingBeforeSitePages = y - MARGIN;
  if (sitePagesBlockHeight > remainingBeforeSitePages) {
    startNewPage();
  }
  drawSectionTitle("Pages du site");
  drawSitePagesTable(params.sitePages);

  y -= sectionTopSpacing;
  const featuresBlockHeight =
    sectionBlockOverhead + estimateBulletListHeight(params.features);
  const remainingBeforeFeatures = y - MARGIN;
  if (featuresBlockHeight > remainingBeforeFeatures) {
    startNewPage();
  }
  drawSectionTitle("Fonctionnalites incluses");
  drawBulletList(params.features);

  y -= sectionTopSpacing;
  const technicalBlockHeight =
    sectionBlockOverhead + estimateParagraphHeight(params.technicalDescription);
  const remainingBeforeTechnical = y - MARGIN;
  if (technicalBlockHeight > remainingBeforeTechnical) {
    startNewPage();
  }
  drawSectionTitle("Description technique");
  drawParagraph(params.technicalDescription);

  y -= sectionTopSpacing;
  const planningBlockHeight =
    sectionBlockOverhead + estimateParagraphHeight(params.planning);
  const remainingBeforePlanning = y - MARGIN;
  if (planningBlockHeight > remainingBeforePlanning) {
    startNewPage();
  }
  drawSectionTitle("Planning");
  drawParagraph(params.planning);

  const items = [...params.items];
  const totalHt = items.reduce((sum, item) => sum + item.priceHt, 0);
  const tva = totalHt * 0.2;
  const totalTtc = totalHt + tva;

  const labelColWidthEstimate = contentWidth - 130;
  const financialRowsHeight = items.reduce((total, item) => {
    const lines = wrapText(
      item.label,
      fontRegular,
      9.5,
      labelColWidthEstimate - 12,
    );
    const rowHeight = Math.max(28, Math.max(1, lines.length) * 13 + 8);
    return total + rowHeight;
  }, 0);
  const estimatedFinancialHeight = 28 + 24 + financialRowsHeight + 8 + 70;

  const maintenanceChunks = splitLines(params.maintenance.description);
  const maintenanceLinesCount =
    maintenanceChunks.length === 0
      ? 1
      : maintenanceChunks.reduce(
          (total, chunk) =>
            total + wrapText(chunk, fontRegular, 10, contentWidth).length,
          0,
        );
  const estimatedMaintenanceHeight =
    28 + // titre section
    24 + // tarif + choix client
    24 + // cases oui/non
    maintenanceLinesCount * 20 +
    8;

  const paymentChunks = splitLines(params.paymentTerms);
  const paymentLinesCount =
    paymentChunks.length === 0
      ? 1
      : paymentChunks.reduce(
          (total, chunk) =>
            total + wrapText(chunk, fontRegular, 10, contentWidth).length,
          0,
        );
  const estimatedPaymentHeight = paymentLinesCount * 20 + 8;

  y -= 14;
  const financialBlockHeight = sectionBlockOverhead + estimatedFinancialHeight;
  if (financialBlockHeight > y - MARGIN) {
    startNewPage();
  }
  drawSectionTitle("Offre de base - Detail financier");
  drawFinancialTable(items);

  y -= 4;
  ensureSpace(70);
  page.drawRectangle({
    x: A4_WIDTH - MARGIN - 220,
    y: y - 48,
    width: 220,
    height: 56,
    color: rgb(1, 1, 1),
    borderColor: palette.border,
    borderWidth: 0.8,
  });
  page.drawText(`Total HT: ${formatMoney(totalHt)}`, {
    x: A4_WIDTH - MARGIN - 210,
    y: y - 10,
    size: 10,
    font: fontBold,
    color: palette.text,
  });
  page.drawText(`TVA (20%): ${formatMoney(tva)}`, {
    x: A4_WIDTH - MARGIN - 210,
    y: y - 24,
    size: 10,
    font: fontRegular,
    color: palette.muted,
  });
  page.drawText(`Total TTC: ${formatMoney(totalTtc)}`, {
    x: A4_WIDTH - MARGIN - 210,
    y: y - 38,
    size: 11,
    font: fontBold,
    color: palette.accent,
  });
  page.drawLine({
    start: { x: A4_WIDTH - MARGIN - 220, y: y - 41 },
    end: { x: A4_WIDTH - MARGIN, y: y - 41 },
    thickness: 0.8,
    color: palette.border,
  });
  y -= 62;

  y -= 14;
  const maintenanceBlockHeight =
    sectionBlockOverhead + estimatedMaintenanceHeight;
  if (maintenanceBlockHeight > y - MARGIN) {
    startNewPage();
  }
  drawSectionTitle("Option Maintenance technique");
  drawLine("Tarif: 40,00 EUR / mois");
  drawLine("Choix client (cocher une case):");

  ensureSpace(24);
  const checkStartX = MARGIN;
  const checkY = y - 2;
  const box = 10;

  page.drawRectangle({
    x: checkStartX,
    y: checkY,
    width: box,
    height: box,
    borderColor: palette.muted,
    borderWidth: 1,
  });
  page.drawText("Oui", {
    x: checkStartX + 16,
    y: checkY + 1,
    size: 10,
    font: fontRegular,
    color: palette.text,
  });

  page.drawRectangle({
    x: checkStartX + 72,
    y: checkY,
    width: box,
    height: box,
    borderColor: palette.muted,
    borderWidth: 1,
  });
  page.drawText("Non", {
    x: checkStartX + 88,
    y: checkY + 1,
    size: 10,
    font: fontRegular,
    color: palette.text,
  });

  y -= 20;
  drawParagraph(params.maintenance.description);

  y -= 14;
  const paymentBlockHeight = sectionBlockOverhead + estimatedPaymentHeight;
  if (paymentBlockHeight > y - MARGIN) {
    startNewPage();
  }
  drawSectionTitle("Modalites de paiement");
  drawParagraph(params.paymentTerms);

  y -= 14;
  const validationBlockHeight = sectionBlockOverhead + 138;
  if (validationBlockHeight > y - MARGIN) {
    startNewPage();
  }
  drawSectionTitle("Validation client");
  ensureSpace(138);

  const boxWidth = (contentWidth - 16) / 2;
  const boxHeight = 90;

  page.drawRectangle({
    x: MARGIN,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    color: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
  });
  page.drawRectangle({
    x: MARGIN + boxWidth + 16,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    color: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
  });

  page.drawText("Signature prestataire", {
    x: MARGIN + 10,
    y: y - 16,
    size: 9,
    font: fontBold,
    color: palette.accent,
  });
  page.drawText("Signature / cachet client", {
    x: MARGIN + boxWidth + 26,
    y: y - 16,
    size: 9,
    font: fontBold,
    color: palette.accent,
  });

  page.drawText("Date et signature", {
    x: MARGIN + 10,
    y: y - boxHeight + 12,
    size: 8,
    font: fontRegular,
    color: palette.muted,
  });
  page.drawText("Date, signature et cachet", {
    x: MARGIN + boxWidth + 26,
    y: y - boxHeight + 12,
    size: 8,
    font: fontRegular,
    color: palette.muted,
  });

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const current = pages[i];
    const footerY = 24;
    current.drawLine({
      start: { x: MARGIN, y: footerY + 12 },
      end: { x: A4_WIDTH - MARGIN, y: footerY + 12 },
      thickness: 0.6,
      color: palette.border,
    });
    current.drawText(params.quoteNumber, {
      x: MARGIN,
      y: footerY,
      size: 8,
      font: fontRegular,
      color: palette.muted,
    });
    current.drawText(`Page ${i + 1}/${pages.length}`, {
      x: A4_WIDTH - MARGIN - 56,
      y: footerY,
      size: 8,
      font: fontRegular,
      color: palette.muted,
    });
  }

  return pdfDoc.save();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; clientId: string }> },
) {
  try {
    const { workspaceId, clientId } = await context.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return new Response("Non authentifie.", { status: 401 });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { id: true },
    });
    if (!membership) {
      return new Response("Acces refuse.", { status: 403 });
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, workspaceId },
      select: { id: true, company: true },
    });
    if (!client) {
      return new Response("Client introuvable.", { status: 404 });
    }

    const rawPayload = await request.json();
    const parsed = quotePayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return new Response(
        parsed.error.issues[0]?.message || "Payload invalide.",
        {
          status: 400,
        },
      );
    }

    const payload = parsed.data;

    const allItems = [...payload.items];

    const subtotal = allItems.reduce((sum, item) => sum + item.priceHt, 0);
    const taxAmount = subtotal * 0.2;
    const total = subtotal + taxAmount;

    const quoteNumber = buildQuoteNumber();

    const pdfBytes = await buildQuotePdf({
      quoteNumber,
      clientLabel: client.company ?? "Entreprise non renseignee",
      createdAt: payload.createdAt,
      creator: {
        name: payload.creator.name,
        email: payload.creator.email,
        phone: payload.creator.phone,
        siret: payload.creator.siret,
      },
      needSummary: payload.needSummary,
      sitePages: payload.sitePages,
      features: payload.features,
      technicalDescription: payload.technicalDescription,
      planning: payload.planning,
      paymentTerms: payload.paymentTerms,
      maintenance: payload.maintenance,
      items: payload.items,
    });

    const quoteInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: quoteNumber,
        status: "DRAFT",
        issueDate: parseIssueDate(payload.createdAt),
        currency: "EUR",
        subtotal: toMoneyDecimal(subtotal),
        taxRate: toMoneyDecimal(20),
        taxAmount: toMoneyDecimal(taxAmount),
        total: toMoneyDecimal(total),
        notes: [
          "Document genere depuis le module devis client.",
          `Resume du besoin: ${payload.needSummary}`,
          `Description technique: ${payload.technicalDescription}`,
          `Planning: ${payload.planning}`,
          `Modalites de paiement: ${payload.paymentTerms}`,
          "Option maintenance: 40,00 EUR / mois (case Oui/Non a cocher dans le devis)",
          `Maintenance: ${payload.maintenance.description}`,
        ].join("\n\n"),
        workspaceId,
        clientId: client.id,
        createdById: userId,
        items: {
          create: allItems.map((item, index) => ({
            workspaceId,
            label: item.label,
            description: null,
            quantity: "1.00",
            unitPrice: toMoneyDecimal(item.priceHt),
            total: toMoneyDecimal(item.priceHt),
            sortOrder: index,
          })),
        },
      },
      select: { invoiceNumber: true },
    });

    const filename = `devis-${(client.company ?? "entreprise")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")}-${quoteInvoice.invoiceNumber}.pdf`;

    const responseBytes = Uint8Array.from(pdfBytes);

    return new Response(responseBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Generation du devis impossible.", { status: 500 });
  }
}

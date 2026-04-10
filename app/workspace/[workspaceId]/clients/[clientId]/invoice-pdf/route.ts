import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs/promises";
import path from "node:path";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const creatorSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(5),
  siret: z.string().trim().min(5),
});

const lineSchema = z.object({
  label: z.string().trim().min(1),
  priceHt: z.number().min(0),
});

const payloadSchema = z
  .object({
    creator: creatorSchema,
    issuedAt: z.string().trim().min(1),
    paymentTerms: z.string().trim().min(1),
    conditionsText: z.string().trim().min(1),
    bankDetails: z.string().trim().min(1),
    projectId: z.string().trim().optional(),
    sourceQuoteId: z.string().trim().optional(),
    items: z.array(lineSchema).optional(),
  })
  .superRefine((input, ctx) => {
    const hasSource = Boolean(input.sourceQuoteId);
    const hasItems = Boolean(input.items && input.items.length > 0);

    if (hasSource === hasItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choisis soit un devis source, soit des lignes manuelles.",
      });
    }
  });

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function toMoneyDecimal(value: number): string {
  return value.toFixed(2);
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

async function loadAsset(relativePath: string) {
  const absolute = path.join(process.cwd(), "public", relativePath);
  try {
    return await fs.readFile(absolute);
  } catch {
    return null;
  }
}

async function buildInvoicePdf(input: {
  invoiceNumber: string;
  issuedAt: Date;
  clientCompany: string;
  clientAddressLines: string[];
  clientSiret: string | null;
  creator: {
    name: string;
    email: string;
    phone: string;
    siret: string;
  };
  paymentTerms: string;
  conditionsText: string;
  bankDetails: string;
  lines: Array<{ label: string; priceHt: number }>;
  sourceQuoteNumber?: string;
}) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const MARGIN = 40;
  const contentWidth = A4_WIDTH - MARGIN * 2;

  const palette = {
    text: rgb(0.12, 0.12, 0.13),
    muted: rgb(0.4, 0.4, 0.42),
    border: rgb(0.82, 0.82, 0.84),
    accent: rgb(0.08, 0.08, 0.09),
    surface: rgb(0.99, 0.99, 0.995),
  };

  const urbanistData = await loadAsset("fonts/Urbanist-VariableFont_wght.ttf");
  const quicksandData = await loadAsset(
    "fonts/Quicksand-VariableFont_wght.ttf",
  );

  const titleFont = urbanistData
    ? await doc.embedFont(urbanistData)
    : await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = quicksandData
    ? await doc.embedFont(quicksandData)
    : await doc.embedFont(StandardFonts.Helvetica);

  const logoBytes = await loadAsset("logo/Logo_inTheGleam_Black.png");
  const logo = logoBytes ? await doc.embedPng(logoBytes) : null;

  let page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight < MARGIN) {
      page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
      y = A4_HEIGHT - MARGIN;
    }
  };

  const startNewPage = () => {
    page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    y = A4_HEIGHT - MARGIN;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(24);
    page.drawText(title, {
      x: MARGIN,
      y,
      size: 12,
      font: titleFont,
      color: palette.accent,
    });
    y -= 12;
    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: A4_WIDTH - MARGIN, y: y + 2 },
      thickness: 0.7,
      color: palette.border,
    });
    y -= 9;
  };

  const drawCompactSectionTitle = (title: string) => {
    ensureSpace(24);
    page.drawText(title, {
      x: MARGIN,
      y,
      size: 10,
      font: titleFont,
      color: palette.accent,
    });
    y -= 10;
    page.drawLine({
      start: { x: MARGIN, y: y + 1 },
      end: { x: A4_WIDTH - MARGIN, y: y + 1 },
      thickness: 0.6,
      color: palette.border,
    });
    y -= 10;
  };

  const drawParagraph = (text: string) => {
    const chunks = splitLines(text);
    if (chunks.length === 0) {
      ensureSpace(16);
      page.drawText("-", {
        x: MARGIN,
        y,
        size: 9,
        font: bodyFont,
        color: palette.text,
      });
      y -= 16;
      return;
    }

    for (const chunk of chunks) {
      const lines = wrapText(chunk, bodyFont, 9, contentWidth);
      for (const line of lines) {
        ensureSpace(14);
        page.drawText(line, {
          x: MARGIN,
          y,
          size: 9,
          font: bodyFont,
          color: palette.text,
        });
        y -= 14;
      }
      y -= 2;
    }
  };

  const estimateParagraphHeight = (text: string) => {
    const chunks = splitLines(text);
    if (chunks.length === 0) return 20;

    return chunks.reduce((total, chunk) => {
      const lines = wrapText(chunk, bodyFont, 9, contentWidth).length;
      return total + Math.max(1, lines) * 14 + 2;
    }, 0);
  };

  const drawProviderCard = () => {
    const cardHeight = 78;
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

    const leftX = MARGIN + 12;
    const rightX = MARGIN + contentWidth / 2 + 6;
    const firstLabelY = y - 16;
    const firstValueY = y - 29;
    const secondLabelY = y - 44;
    const secondValueY = y - 57;

    page.drawText("NOM", {
      x: leftX,
      y: firstLabelY,
      size: 8,
      font: titleFont,
      color: palette.muted,
    });
    page.drawText(input.creator.name, {
      x: leftX,
      y: firstValueY,
      size: 10,
      font: bodyFont,
      color: palette.text,
      maxWidth: contentWidth / 2 - 18,
    });

    page.drawText("SIRET", {
      x: rightX,
      y: firstLabelY,
      size: 8,
      font: titleFont,
      color: palette.muted,
    });
    page.drawText(input.creator.siret, {
      x: rightX,
      y: firstValueY,
      size: 10,
      font: bodyFont,
      color: palette.text,
      maxWidth: contentWidth / 2 - 18,
    });

    page.drawText("EMAIL", {
      x: leftX,
      y: secondLabelY,
      size: 8,
      font: titleFont,
      color: palette.muted,
    });
    page.drawText(input.creator.email, {
      x: leftX,
      y: secondValueY,
      size: 10,
      font: bodyFont,
      color: palette.text,
      maxWidth: contentWidth / 2 - 18,
    });

    page.drawText("TELEPHONE", {
      x: rightX,
      y: secondLabelY,
      size: 8,
      font: titleFont,
      color: palette.muted,
    });
    page.drawText(input.creator.phone, {
      x: rightX,
      y: secondValueY,
      size: 10,
      font: bodyFont,
      color: palette.text,
      maxWidth: contentWidth / 2 - 18,
    });

    y -= cardHeight;
  };

  const drawItemsTable = (
    entries: Array<{ label: string; priceHt: number }>,
  ) => {
    const labelColWidth = contentWidth - 130;
    const priceColWidth = contentWidth - labelColWidth;
    const headerHeight = 22;

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
        font: titleFont,
        color: rgb(1, 1, 1),
      });
      page.drawText("PRIX HT", {
        x: MARGIN + labelColWidth + 8,
        y: y - 15,
        size: 10,
        font: titleFont,
        color: rgb(1, 1, 1),
      });
      y -= headerHeight;
    };

    drawTableHeader();

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const labelLines = wrapText(
        entry.label,
        bodyFont,
        9.5,
        labelColWidth - 12,
      );
      const priceLines = wrapText(
        formatCurrency(entry.priceHt),
        titleFont,
        9.5,
        priceColWidth - 12,
      );
      const lineCount = Math.max(labelLines.length, priceLines.length);
      const rowHeight = Math.max(24, lineCount * 12 + 6);

      if (y - rowHeight < MARGIN) {
        page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
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
          y: y - 13 - i * 12,
          size: 9.5,
          font: bodyFont,
          color: palette.text,
        });
      }
      for (let i = 0; i < priceLines.length; i += 1) {
        page.drawText(priceLines[i], {
          x: MARGIN + labelColWidth + 8,
          y: y - 13 - i * 12,
          size: 9.5,
          font: titleFont,
          color: palette.text,
        });
      }

      y -= rowHeight;
    }

    y -= 10;
  };

  const drawTotalsTable = (subtotal: number, vat: number, total: number) => {
    const rows = [
      ["Sous-total HT", formatCurrency(subtotal)],
      ["TVA (20%)", formatCurrency(vat)],
      ["Total TTC", formatCurrency(total)],
    ] as const;

    const labelColWidth = contentWidth - 140;
    const rowHeight = 22;
    const tableHeight = rows.length * rowHeight;
    ensureSpace(tableHeight + 8);

    for (let i = 0; i < rows.length; i += 1) {
      const [label, value] = rows[i];
      const isTotal = i === rows.length - 1;

      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: isTotal
          ? palette.accent
          : i % 2 === 0
            ? palette.surface
            : rgb(1, 1, 1),
        borderColor: palette.border,
        borderWidth: 0.7,
      });
      page.drawLine({
        start: { x: MARGIN + labelColWidth, y },
        end: { x: MARGIN + labelColWidth, y: y - rowHeight },
        thickness: 0.7,
        color: palette.border,
      });

      page.drawText(label, {
        x: MARGIN + 8,
        y: y - 15,
        size: 10,
        font: titleFont,
        color: isTotal ? rgb(1, 1, 1) : palette.text,
      });
      page.drawText(value, {
        x: MARGIN + labelColWidth + 8,
        y: y - 15,
        size: 10,
        font: titleFont,
        color: isTotal ? rgb(1, 1, 1) : palette.text,
      });

      y -= rowHeight;
    }

    y -= 12;
  };

  const drawFooterPageNumber = () => {
    const pages = doc.getPages();
    pages.forEach((pdfPage, index) => {
      pdfPage.drawText(`Page ${index + 1}/${pages.length}`, {
        x: A4_WIDTH - MARGIN - 70,
        y: 18,
        size: 9,
        font: bodyFont,
        color: palette.muted,
      });
    });
  };

  const headerHeight = 108;
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
  page.drawRectangle({
    x: MARGIN,
    y: y - 44 + 8,
    width: contentWidth,
    height: 44,
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

  page.drawText("FACTURE", {
    x: MARGIN + 132,
    y: y - 23,
    size: 27,
    font: titleFont,
    color: rgb(1, 1, 1),
  });
  page.drawText(`N° ${input.invoiceNumber}`, {
    x: MARGIN + 132,
    y: y - 62,
    size: 10,
    font: titleFont,
    color: palette.text,
  });
  page.drawText(`Date : ${formatDate(input.issuedAt)}`, {
    x: MARGIN + 132,
    y: y - 76,
    size: 10,
    font: bodyFont,
    color: palette.text,
  });
  page.drawText(`Entreprise cliente : ${input.clientCompany}`, {
    x: MARGIN + 132,
    y: y - 90,
    size: 10,
    font: bodyFont,
    color: palette.text,
  });

  if (logo) {
    const ratio = logo.width / logo.height;
    const logoWidth = 90;
    const logoHeight = logoWidth / ratio;
    const maxHeight = headerHeight - 38;
    const finalHeight = Math.min(logoHeight, maxHeight);
    const finalWidth = finalHeight * ratio;
    page.drawImage(logo, {
      x: MARGIN + 10 + (logoPanelWidth - finalWidth) / 2,
      y: y - headerHeight + 28,
      width: finalWidth,
      height: finalHeight,
    });
  }

  y -= headerHeight + 8;
  drawProviderCard();

  const interSectionSpacing = 12;
  const attentionToFinancialSpacing = 18;
  y -= interSectionSpacing;

  const attentionLeftLines = [input.clientCompany];
  const attentionRightLines = [
    ...input.clientAddressLines,
    `SIRET : ${input.clientSiret ?? "—"}`,
  ];
  const leftBlockHeight = 18 + attentionLeftLines.length * 13;
  const rightBlockHeight = 18 + attentionRightLines.length * 13;
  const attentionCardHeight = Math.max(
    52,
    Math.max(leftBlockHeight, rightBlockHeight) + 10,
  );
  const attentionLeftX = MARGIN + 12;
  const attentionRightX = MARGIN + contentWidth / 2 + 10;
  const columnDividerX = MARGIN + contentWidth / 2;

  ensureSpace(attentionCardHeight + 10);
  page.drawRectangle({
    x: MARGIN,
    y: y - attentionCardHeight,
    width: contentWidth,
    height: attentionCardHeight,
    color: palette.surface,
    borderColor: palette.border,
    borderWidth: 0.8,
  });
  page.drawRectangle({
    x: MARGIN,
    y: y - attentionCardHeight,
    width: 4,
    height: attentionCardHeight,
    color: palette.accent,
  });
  page.drawLine({
    start: { x: columnDividerX, y },
    end: { x: columnDividerX, y: y - attentionCardHeight },
    thickness: 0.6,
    color: palette.border,
  });

  page.drawText("A L'ATTENTION DE", {
    x: attentionLeftX,
    y: y - 14,
    size: 8,
    font: titleFont,
    color: palette.muted,
  });
  page.drawText("ADRESSE / SIRET", {
    x: attentionRightX,
    y: y - 14,
    size: 8,
    font: titleFont,
    color: palette.muted,
  });

  let attentionLeftY = y - 31;
  attentionLeftLines.forEach((line, index) => {
    page.drawText(line, {
      x: attentionLeftX,
      y: attentionLeftY,
      size: index === 0 ? 12 : 10,
      font: index === 0 ? titleFont : bodyFont,
      color: palette.text,
      maxWidth: contentWidth / 2 - 22,
    });
    attentionLeftY -= 13;
  });

  let attentionRightY = y - 31;
  attentionRightLines.forEach((line, index) => {
    page.drawText(line, {
      x: attentionRightX,
      y: attentionRightY,
      size: 10,
      font:
        index === attentionRightLines.length - 1 && input.clientSiret
          ? titleFont
          : bodyFont,
      color: palette.text,
      maxWidth: contentWidth / 2 - 22,
    });
    attentionRightY -= 13;
  });

  y -= attentionCardHeight + attentionToFinancialSpacing;

  drawSectionTitle("Détail financier");
  drawItemsTable(input.lines);

  const subtotal = input.lines.reduce((sum, line) => sum + line.priceHt, 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;
  drawTotalsTable(subtotal, vat, total);

  const postFinancialSpacing = 18;
  const finalBlockHeight =
    postFinancialSpacing +
    24 +
    estimateParagraphHeight(input.paymentTerms) +
    10 +
    10 +
    24 +
    estimateParagraphHeight(input.conditionsText) +
    10 +
    10 +
    24 +
    estimateParagraphHeight(input.bankDetails) +
    8;
  if (y - finalBlockHeight < MARGIN) {
    startNewPage();
  }

  y -= postFinancialSpacing;

  drawCompactSectionTitle("Échéance");
  drawParagraph(input.paymentTerms);
  y -= 8;

  drawCompactSectionTitle("Conditions");
  drawParagraph(input.conditionsText);
  y -= 8;

  drawCompactSectionTitle("Détails bancaires");
  drawParagraph(input.bankDetails);

  drawFooterPageNumber();

  return Buffer.from(await doc.save());
}

async function createInvoiceNumber(workspaceId: string) {
  const facCount = await prisma.invoice.count({
    where: {
      workspaceId,
      invoiceNumber: {
        startsWith: "FAC-",
      },
    },
  });

  return `FAC-${String(facCount + 1).padStart(4, "0")}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string; clientId: string }> },
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;
    if (!userEmail) {
      return new NextResponse("Non authentifie", { status: 401 });
    }

    const { workspaceId, clientId } = await context.params;

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: {
          email: userEmail,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return new NextResponse("Acces interdit", { status: 403 });
    }

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId,
      },
      select: {
        id: true,
        company: true,
        email: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        country: true,
        siret: true,
      },
    });

    if (!client) {
      return new NextResponse("Client introuvable", { status: 404 });
    }

    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return new NextResponse(
        parsed.error.issues[0]?.message ?? "Payload invalide",
        {
          status: 400,
        },
      );
    }

    const data = parsed.data;

    let linkedProjectId: string | null = null;
    if (data.projectId) {
      const linkedProject = await prisma.project.findFirst({
        where: {
          id: data.projectId,
          workspaceId,
          clientId,
        },
        select: { id: true },
      });

      if (!linkedProject) {
        return new NextResponse("Projet introuvable pour ce client", {
          status: 400,
        });
      }

      linkedProjectId = linkedProject.id;
    }

    let sourceQuoteNumber: string | undefined;
    let lines: Array<{ label: string; priceHt: number }> = [];

    if (data.sourceQuoteId) {
      const sourceQuote = await prisma.invoice.findFirst({
        where: {
          id: data.sourceQuoteId,
          workspaceId,
          clientId,
          invoiceNumber: {
            startsWith: "DEV-",
          },
        },
        select: {
          invoiceNumber: true,
          items: {
            orderBy: {
              sortOrder: "asc",
            },
            select: {
              label: true,
              unitPrice: true,
              total: true,
            },
          },
        },
      });

      if (!sourceQuote) {
        return new NextResponse("Devis source introuvable", { status: 404 });
      }

      sourceQuoteNumber = sourceQuote.invoiceNumber;
      lines = sourceQuote.items.map((item) => ({
        label: item.label,
        priceHt: Number(item.total ?? item.unitPrice),
      }));
    } else if (data.items) {
      lines = data.items;
    }

    if (lines.length === 0) {
      return new NextResponse("Aucune ligne de facture", { status: 400 });
    }

    const issuedAtDate = new Date(data.issuedAt);
    if (Number.isNaN(issuedAtDate.getTime())) {
      return new NextResponse("Date de facture invalide", { status: 400 });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.priceHt, 0);
    const tax = subtotal * 0.2;
    const total = subtotal + tax;

    const invoiceNumber = await createInvoiceNumber(workspaceId);

    await prisma.invoice.create({
      data: {
        workspaceId,
        clientId,
        invoiceNumber,
        issueDate: issuedAtDate,
        dueDate: issuedAtDate,
        currency: "EUR",
        subtotal: toMoneyDecimal(subtotal),
        taxRate: toMoneyDecimal(20),
        taxAmount: toMoneyDecimal(tax),
        total: toMoneyDecimal(total),
        status: "SENT",
        createdById: userId,
        projectId: linkedProjectId,
        notes: sourceQuoteNumber
          ? `Facture generee depuis ${sourceQuoteNumber}.\n${data.paymentTerms}`
          : data.paymentTerms,
        items: {
          create: lines.map((line, index) => ({
            workspaceId,
            label: line.label,
            description: null,
            quantity: "1.00",
            unitPrice: toMoneyDecimal(line.priceHt),
            total: toMoneyDecimal(line.priceHt),
            sortOrder: index,
          })),
        },
      },
    });

    const pdf = await buildInvoicePdf({
      invoiceNumber,
      issuedAt: issuedAtDate,
      clientCompany: client.company ?? "Entreprise non renseignee",
      clientAddressLines: [
        [
          client.addressLine1,
          client.addressLine2,
          [client.postalCode, client.city].filter(Boolean).join(" "),
        ]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(", "),
      ].filter((line): line is string => Boolean(line && line.trim())),
      clientSiret: client.siret,
      creator: data.creator,
      paymentTerms: data.paymentTerms,
      conditionsText: data.conditionsText,
      bankDetails: data.bankDetails,
      lines,
      sourceQuoteNumber,
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Invoice PDF generation failed", error);
    return new NextResponse("Erreur serveur pendant la generation de facture", {
      status: 500,
    });
  }
}

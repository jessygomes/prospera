import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs/promises";
import path from "node:path";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
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
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }

  lines.push(current);
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

async function buildPdf(input: {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  clientCompany: string;
  clientAddressLines: string[];
  clientSiret: string | null;
  creatorName: string;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  lines: Array<{ label: string; total: number }>;
}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const MARGIN = 40;
  const contentWidth = A4_WIDTH - MARGIN * 2;

  const urbanistData = await loadAsset("fonts/Urbanist-VariableFont_wght.ttf");
  const quicksandData = await loadAsset(
    "fonts/Quicksand-VariableFont_wght.ttf",
  );
  const logoBytes = await loadAsset("logo/Logo_inTheGleam_Black.png");

  const fontBold = urbanistData
    ? await pdfDoc.embedFont(urbanistData)
    : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = quicksandData
    ? await pdfDoc.embedFont(quicksandData)
    : await pdfDoc.embedFont(StandardFonts.Helvetica);

  const logo = logoBytes ? await pdfDoc.embedPng(logoBytes) : null;

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight < MARGIN) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      y = A4_HEIGHT - MARGIN;
    }
  };

  const palette = {
    text: rgb(0.12, 0.12, 0.13),
    muted: rgb(0.4, 0.4, 0.42),
    border: rgb(0.82, 0.82, 0.84),
    accent: rgb(0.08, 0.08, 0.09),
    surface: rgb(0.99, 0.99, 0.995),
  };

  const isQuote = input.invoiceNumber.startsWith("DEV-");
  const docLabel = isQuote ? "DEVIS" : "FACTURE";

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

  page.drawText(docLabel, {
    x: MARGIN + 132,
    y: y - 23,
    size: 27,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`N° ${input.invoiceNumber}`, {
    x: MARGIN + 132,
    y: y - 62,
    size: 10,
    font: fontBold,
    color: palette.text,
  });
  page.drawText(`Date : ${formatDate(input.issueDate)}`, {
    x: MARGIN + 132,
    y: y - 76,
    size: 10,
    font: fontRegular,
    color: palette.text,
  });
  page.drawText(`Entreprise cliente : ${input.clientCompany}`, {
    x: MARGIN + 132,
    y: y - 90,
    size: 10,
    font: fontRegular,
    color: palette.text,
  });

  if (logo) {
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

  y -= headerHeight + 18;

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
    font: fontBold,
    color: palette.muted,
  });
  page.drawText("ADRESSE / SIRET", {
    x: attentionRightX,
    y: y - 14,
    size: 8,
    font: fontBold,
    color: palette.muted,
  });

  let attentionLeftY = y - 31;
  attentionLeftLines.forEach((line, index) => {
    page.drawText(line, {
      x: attentionLeftX,
      y: attentionLeftY,
      size: index === 0 ? 12 : 10,
      font: index === 0 ? fontBold : fontRegular,
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
          ? fontBold
          : fontRegular,
      color: palette.text,
      maxWidth: contentWidth / 2 - 22,
    });
    attentionRightY -= 13;
  });

  y -= attentionCardHeight + 18;

  page.drawText("Detail financier", {
    x: MARGIN,
    y,
    size: 12,
    font: fontBold,
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

  const labelColWidth = contentWidth - 130;
  const priceColWidth = contentWidth - labelColWidth;
  const headerRowHeight = 22;

  const drawTableHeader = () => {
    ensureSpace(headerRowHeight + 8);
    page.drawRectangle({
      x: MARGIN,
      y: y - headerRowHeight,
      width: contentWidth,
      height: headerRowHeight,
      color: palette.accent,
    });
    page.drawLine({
      start: { x: MARGIN + labelColWidth, y },
      end: { x: MARGIN + labelColWidth, y: y - headerRowHeight },
      thickness: 0.8,
      color: palette.border,
    });
    page.drawText("ITEM", {
      x: MARGIN + 8,
      y: y - 14,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("PRIX HT", {
      x: MARGIN + labelColWidth + 8,
      y: y - 14,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    y -= headerRowHeight;
  };

  drawTableHeader();

  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index];
    const labelLines = wrapText(
      line.label,
      fontRegular,
      9.5,
      labelColWidth - 12,
    );
    const priceLines = wrapText(
      formatCurrency(line.total),
      fontBold,
      9.5,
      priceColWidth - 12,
    );
    const rowHeight = Math.max(
      24,
      Math.max(labelLines.length, priceLines.length) * 12 + 6,
    );

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
        y: y - 13 - i * 12,
        size: 9.5,
        font: fontRegular,
        color: palette.text,
      });
    }

    for (let i = 0; i < priceLines.length; i += 1) {
      page.drawText(priceLines[i], {
        x: MARGIN + labelColWidth + 8,
        y: y - 13 - i * 12,
        size: 9.5,
        font: fontBold,
        color: palette.text,
      });
    }

    y -= rowHeight;
  }

  y -= 12;

  const totalsRows = [
    ["Sous-total HT", formatCurrency(input.subtotal)],
    ["TVA", formatCurrency(input.taxAmount)],
    ["Total TTC", formatCurrency(input.total)],
  ] as const;

  const totalLabelColWidth = contentWidth - 140;
  const totalsRowHeight = 22;

  for (let i = 0; i < totalsRows.length; i += 1) {
    ensureSpace(totalsRowHeight + 4);
    const [label, value] = totalsRows[i];
    const isTotal = i === totalsRows.length - 1;

    page.drawRectangle({
      x: MARGIN,
      y: y - totalsRowHeight,
      width: contentWidth,
      height: totalsRowHeight,
      color: isTotal
        ? palette.accent
        : i % 2 === 0
          ? palette.surface
          : rgb(1, 1, 1),
      borderColor: palette.border,
      borderWidth: 0.7,
    });
    page.drawLine({
      start: { x: MARGIN + totalLabelColWidth, y },
      end: { x: MARGIN + totalLabelColWidth, y: y - totalsRowHeight },
      thickness: 0.7,
      color: palette.border,
    });

    page.drawText(label, {
      x: MARGIN + 8,
      y: y - 14,
      size: 10,
      font: fontBold,
      color: isTotal ? rgb(1, 1, 1) : palette.text,
    });
    page.drawText(value, {
      x: MARGIN + totalLabelColWidth + 8,
      y: y - 14,
      size: 10,
      font: fontBold,
      color: isTotal ? rgb(1, 1, 1) : palette.text,
    });

    y -= totalsRowHeight;
  }

  if (input.notes?.trim()) {
    y -= 14;
    ensureSpace(40);
    page.drawText("Notes", {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: palette.accent,
    });
    y -= 12;
    const noteLines = wrapText(input.notes, fontRegular, 9, contentWidth);
    for (const line of noteLines.slice(0, 14)) {
      ensureSpace(12);
      page.drawText(line, {
        x: MARGIN,
        y,
        size: 9,
        font: fontRegular,
        color: palette.text,
      });
      y -= 12;
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(`Page ${idx + 1}/${pages.length}`, {
      x: A4_WIDTH - MARGIN - 70,
      y: 18,
      size: 9,
      font: fontRegular,
      color: palette.muted,
    });
  });

  return Buffer.from(await pdfDoc.save());
}

export async function GET(
  _req: Request,
  context: {
    params: Promise<{
      workspaceId: string;
      clientId: string;
      invoiceId: string;
    }>;
  },
) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email;
    if (!userEmail) {
      return new NextResponse("Non authentifie", { status: 401 });
    }

    const { workspaceId, clientId, invoiceId } = await context.params;

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: { email: userEmail },
      },
      select: { id: true },
    });

    if (!membership) {
      return new NextResponse("Acces interdit", { status: 403 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        workspaceId,
        clientId,
      },
      select: {
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        notes: true,
        client: {
          select: {
            company: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            postalCode: true,
            country: true,
            siret: true,
          },
        },
        createdBy: {
          select: {
            name: true,
          },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            label: true,
            total: true,
          },
        },
      },
    });

    if (!invoice) {
      return new NextResponse("Document introuvable", { status: 404 });
    }

    const subtotal = Number(invoice.subtotal);
    const taxAmount = Number(invoice.taxAmount ?? 0);
    const total = Number(invoice.total);

    const pdf = await buildPdf({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      clientCompany: invoice.client.company ?? "Entreprise non renseignee",
      clientAddressLines: [
        [
          invoice.client.addressLine1,
          invoice.client.addressLine2,
          [invoice.client.postalCode, invoice.client.city]
            .filter(Boolean)
            .join(" "),
        ]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(", "),
      ].filter((line): line is string => Boolean(line && line.trim())),
      clientSiret: invoice.client.siret,
      creatorName: invoice.createdBy?.name ?? "",
      notes: invoice.notes,
      subtotal,
      taxAmount,
      total,
      lines: invoice.items.map((item) => ({
        label: item.label,
        total: Number(item.total),
      })),
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Invoice/Quote PDF regeneration failed", error);
    return new NextResponse("Erreur lors de la regeneration du PDF", {
      status: 500,
    });
  }
}

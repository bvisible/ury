import { printWithQz } from './print-qz';
import {
  getInvoicePrintHtml,
  networkPrint,
  selectNetworkPrinter,
  printPosPage,
  updatePrintStatus,
  cloudprntPrint
} from './invoice-api';
import { __ } from './i18n';
import { PosProfileCombined } from './pos-profile-api';

interface PrintOrderParams {
  orderId: string;
  posProfile: PosProfileCombined
}

export async function printOrder({ orderId, posProfile }: PrintOrderParams): Promise<'qz' | 'network' | 'socket' | 'cloudprnt'> {
  console.log('[PRINT] printOrder called with:', { orderId, posProfile });
  const { print_type, qz_host, print_format, printer, name, cashier, multiple_cashier, cloudprnt_printer, cloudprnt_printer_name } = posProfile;
  console.log('[PRINT] cloudprnt_printer:', cloudprnt_printer, 'cloudprnt_printer_name:', cloudprnt_printer_name);

  // Check CloudPRNT first (based on cloudprnt_printer flag)
  if (cloudprnt_printer && cloudprnt_printer_name) {
    console.log('[PRINT] Using CloudPRNT with printer:', cloudprnt_printer_name);
    await cloudprntPrint(orderId, cloudprnt_printer_name);
    await updatePrintStatus(orderId);
    return 'cloudprnt';
  } else if (print_type === 'cloudprnt') {
    console.log('[PRINT] Using CloudPRNT (print_type) with printer:', cloudprnt_printer_name);
    await cloudprntPrint(orderId, cloudprnt_printer_name);
    await updatePrintStatus(orderId);
    return 'cloudprnt';
  } else if (print_type === 'qz') {
    if (!qz_host) {
      throw new Error(__('QZ host is not set'));
    }
    const html = await getInvoicePrintHtml(orderId, print_format as string);
    await printWithQz(qz_host, html);
    await updatePrintStatus(orderId);
    return 'qz';
  } else if (print_type === 'network') {
    if (cashier && !multiple_cashier) {
      await networkPrint(orderId, printer as string, print_format as string);
    } else {
      await selectNetworkPrinter(orderId, name);
    }
    await updatePrintStatus(orderId);
    return 'network';
  } else {
    await printPosPage(orderId, print_format as string);
    return 'socket';
  }
} 
"""
clasificador.py — Reglas de clasificación de egresos FPM.
Porta las REGLAS y DIRECT_RUTS del pipeline de clasificación masiva.
"""
import re, unicodedata

def _strip(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')

PLAN = {
    "1.1.1": ("Ingredientes",              "CC1"),
    "1.1.2": ("Packaging",                 "CC1"),
    "1.1.3": ("Equipamiento de Cocina",    "CC1"),
    "1.2.1": ("Sueldos con Contrato",      "CC2"),
    "1.2.2": ("Honorarios",                "CC2"),
    "1.2.3": ("Asesoria Contable",         "CC2"),
    "1.2.4": ("Uniformes Personal",        "CC2"),
    "1.2.5": ("Prestamos Personal",        "CC2"),
    "1.3.1": ("Arriendo Local",            "CC3"),
    "1.3.2": ("Agua",                      "CC3"),
    "1.3.3": ("Luz",                       "CC3"),
    "1.3.4": ("Gas",                       "CC3"),
    "1.3.5": ("Telecomunicaciones",        "CC3"),
    "1.3.6": ("Mantenciones",              "CC3"),
    "1.3.7": ("Fumigaciones",              "CC3"),
    "1.3.8": ("Limpieza y Aseo",           "CC3"),
    "1.3.9": ("Seguridad",                 "CC3"),
    "1.3.10":("Equipamiento Local",        "CC3"),
    "1.4.1": ("Inversion Carro",           "CC4"),
    "1.4.2": ("Mantencion Carro",          "CC4"),
    "1.4.5": ("Sueldos Carro",             "CC4"),
    "1.5.1": ("Plataformas Digitales",     "CC5"),
    "1.6.1": ("RRSS",                      "CC6"),
    "1.6.2": ("Produccion Audiovisual",    "CC6"),
    "1.6.3": ("Ferias y Eventos",          "CC6"),
    "1.7.1": ("Despachos B2B",             "CC7"),
    "1.7.2": ("Despachos B2C",             "CC7"),
    "1.7.3": ("Transporte Personas",       "CC7"),
    "1.8.1": ("Comision POS",              "CC8"),
    "1.8.2": ("Comision Delivery",         "CC8"),
    "1.9.1": ("IVA Neto F29",              "CC9"),
    "1.9.4": ("Patente Comercial",         "CC9"),
    "1.9.5": ("Gastos Bancarios",          "CC9"),
}

# (keywords, cuenta, tipo_doc)  — CC se obtiene de PLAN
REGLAS = [
    # CC9
    (["COMIS.MANT","MANT.CTA","MANT CTA","IMP TIMBRE","CARGO FIJO",
      "COMIS BANCO","COMISION BANCO","CARGO LINEA","COMISION LCA",
      "CARGO MERCADO CAPITALES","GASTOS NOTARIALES","ABONO INTERES",
      "INTERESES LINEA","USO LCA"],                              "1.9.5","S"),
    (["F-29","PAGO SII","PAGO IMPUESTO IVA","SERV.IMP","SERV.IMPUEST",
      "FORMULARIO 29"],                                          "1.9.1","S"),
    (["PATENTE COM","PATENTE MUN","MUNICIPALID","M LAS CONDES TES",
      "LAS CONDES TESO","TESORERIA MUN"],                       "1.9.4","S"),
    # CC2 Sueldos
    (["NATALY MORALES","CAROLINA GUTIERR","CAROLINA CAMPO",
      "CATALINA CUEVA","CATALINA BUSTA","VANESSA FLORES",
      "ANGELES GREZ","MARIA IGNACIA","IGNACIA GREZ",
      "MARIA JOSE GRE","JOSE GREZ","LUIS FELIPE GR",
      "MARIA PAULINA","MARISOL MORALE","PEDRO PIZARRO",
      "GIOVANNA MARTI","RODRIGO ANDRES","ANA MARIANELA",
      "PATRICIA DEL R","JOSEFINA LANDE"],                       "1.2.1","S"),
    (["SUELDO","REMUNERACION","LIQUID.","FINIQUITO","PREVIRED"],  "1.2.1","S"),
    (["HONORARIO","BOLETA HON","BOL.HON","ARCE TIRADO"],          "1.2.2","S"),
    (["ASESORIA CONT","CONTADOR","CONTABILID","WISNIAK","NOTARIAL"],"1.2.3","F"),
    (["UNIFORME","ROPA TRABAJO","EPP ","KS*NIKE","NIKE ","COSTURITAS"],"1.2.4","F"),
    # CC1
    (["ALLBAGS","PACKAGING","BOLSAS PAPEL","EMBALAJE","EMPAQUE",
      "STICKERS PRINT","HOMS PACK","MUNDO ETIQUETAS","MUNDO ETIQUETA",
      "STICKERSHOP","DPS CHILE"],                                "1.1.2","F"),
    (["HAULMER","BETTER FOOD","LA VEGA","DISTRIBUIDORA","ALIMENTOS",
      "PREGEL","PRE GEL","GREAT FOODS","INVERSIONES PST","INVERSIONES PS",
      "LA OFERTA COM","ALVI","EXPRESS VITACURA","CAFE DEL PARQUE",
      "CHAVARRY","GOURMET","PROVEEDORES IN","MERPAGO*"],         "1.1.1","F"),
    (["JUMBO","UNIMARC","LIDER ","LIDER.CL","TOTTUS","SANTA ISABEL",
      "ACUENTA","MAYORISTA 10","BIG JOHN","EKONO","SUPERMERCADO"], "1.1.1","F"),
    (["EQUIPO COCINA","MENAJE","UTENSILIOS","DP *FALABELLA",
      "FALABELLA","CASA COSTA"],                                 "1.1.3","F"),
    # CC3
    (["ENEL ","ENEL-","ENEL","CHILECTRA","CGE ","LUZ DEL SUR"],   "1.3.3","F"),
    (["METROGAS","GASCO","ABASTIBLE","LIPIGAS"],                  "1.3.4","F"),
    (["AGUAS ANDINAS","AGUAS CORDILLERA","ESVAL","ESSBIO"],       "1.3.2","F"),
    (["ENTEL ","ENTEL-","CLARO ","MOVISTAR","VTR ","WOM ","GTD "], "1.3.5","F"),
    (["ARRIENDO","GGCC","GASTOS COMUNES"],                        "1.3.1","F"),
    (["FUMIG","CONTROL PLAGA","ANTICIMEX"],                       "1.3.7","F"),
    (["ASEO ","LIMPIEZA","CLEANING","MAESTRANZA"],                "1.3.8","S"),
    (["PROSEGUR","ADT ","SECURITAS","IGOR GALAZ","EXTINTOR"],     "1.3.9","F"),
    (["MANTENC","REPARAC","GASFITER","ELECTRICISTA","PLOMERO",
      "FERRETERIA","EASY.CL","EASYCL","EASY INTERNET","SODIMAC",
      "HOMECENTER","MULTISERVICE","DIMAK","LUIS FELIPE IB"],     "1.3.6","F"),
    (["HARRY PLOTTER","IKEA","PC FACTORY","LAPIZ LOPEZ","OFIEXPRESS",
      "NEWTREE","TAMARUGO","TEMU","ALIEXPRESS","RAUL VELASQUEZ",
      "NP FLOW","MERCADOPAGO *GRRE"],                            "1.3.10","F"),
    # CC5
    (["WIX ","WIX.COM","SHOPIFY","BSALE","GOOGLE WORKS","GOOGLE *W",
      "MICROSOFT 365","MICROSO","ADOBE","ZOOM ","SLACK ","NOTION ",
      "OPENAI","CHATGPT","CANVA","PADDLE","FINTOC","NUBOX","BUK ",
      "DEFONTANA","FLOW *","NP DP","STEWARD WEB","APP-SORTEOS"],  "1.5.1","F"),
    # CC6
    (["FACEBOOK","FACEBK","META ADS","INSTAGRAM","GOOGLE ADS",
      "TIKTOK","YOUTUBE ADS"],                                   "1.6.1","F"),
    (["MI FOTO","COPYEXPRESS","PRODUCCION AUDIO","FOTOGRAF"],     "1.6.2","F"),
    (["FERIA ","EVENTO ","STAND ","INSCRIPCION FER"],             "1.6.3","F"),
    # CC7
    (["STARKEN","CHILEXPRESS","CORREOS CHILE","DHL ","FEDEX",
      "BLUEX","ENVIAME","MUDANGO","LOGISTICA Y TR"],              "1.7.1","F"),
    (["UBER ","CABIFY","DIDI","TAXI ","SABA ","ESTACIONAMIENTO"], "1.7.3","S"),
    # CC8
    (["GETNET","TUU ","TRANSBANK","WEBPAY"],                      "1.8.1","F"),
    (["RAPPI","UBER EATS","UBEREATS","PEDIDOS YA","GOODMEAL"],    "1.8.2","F"),
]

# RUT → (cuenta, tipo_doc)
DIRECT_RUTS: dict[str, tuple[str, str]] = {
    "76034515-6": ("1.3.10","F"), "5279758-6":  ("1.3.6","S"),
    "19567111-7": ("1.2.1","S"),  "17403946-1": ("1.3.1","S"),
    "17083572-7": ("1.2.1","S"),  "18022436-K": ("1.2.1","S"),
    "19324205-7": ("1.2.2","S"),  "21093602-5": ("1.2.1","S"),
    "22520465-9": ("1.2.1","S"),  "19606694-2": ("1.2.1","S"),
    "96719010-1": ("1.3.1","F"),  "10325328-4": ("1.4.5","S"),
    "77406473-7": ("1.1.1","F"),  "96794400-9": ("1.3.10","F"),
    "77423092-0": ("1.3.10","F"), "18866000-2": ("1.2.1","S"),
    "22809808-6": ("1.2.1","S"),  "26715306-K": ("1.6.2","S"),
    "20830554-9": ("1.2.1","S"),  "56059620-0": ("1.3.1","F"),
    "21668806-6": ("1.2.1","S"),  "6551524-5":  ("1.7.1","S"),
    "27417959-7": ("1.2.1","S"),  "20998405-9": ("1.2.1","S"),
    "21572942-7": ("1.2.1","S"),  "21920200-8": ("1.2.1","S"),
    "26070601-2": ("1.2.1","S"),  "19385841-4": ("1.2.1","S"),
    "21832228-K": ("1.2.1","S"),  "18831462-7": ("1.2.1","S"),
    "7051940-2":  ("1.2.1","S"),  "20550382-K": ("1.2.1","S"),
    "19076816-3": ("1.2.1","S"),  "21593197-8": ("1.2.1","S"),
    "25777006-0": ("1.2.1","S"),  "28508344-3": ("1.2.1","S"),
    "18023417-9": ("1.2.1","S"),  "21031185-8": ("1.2.1","S"),
    "22477866-K": ("1.2.1","S"),  "21780804-9": ("1.2.1","S"),
    "21380644-0": ("1.2.1","S"),  "21575375-1": ("1.2.1","S"),
    "16664652-9": ("1.2.1","S"),  "22042791-9": ("1.2.1","S"),
    "18732574-9": ("1.2.1","S"),  "17596955-1": ("1.2.1","S"),
    "6692720-2":  ("1.2.1","S"),  "16538679-5": ("1.2.1","S"),
    "14680015-7": ("1.2.1","S"),  "13904983-7": ("1.2.1","S"),
    "10280475-9": ("1.2.1","S"),  "19566954-6": ("1.2.1","S"),
    "27347007-7": ("1.2.1","S"),  "17598442-9": ("1.2.1","S"),
    "20380030-4": ("1.2.1","S"),  "6425492-8":  ("1.2.1","S"),
    "17315403-8": ("1.2.1","S"),  "17628639-3": ("1.2.1","S"),
    "18304557-1": ("1.2.1","S"),  "7763240-9":  ("1.2.1","S"),
    "8752088-9":  ("1.2.1","S"),  "25472065-8": ("1.2.1","S"),
    "21081516-3": ("1.2.1","S"),
}

RUT_RE = re.compile(r"\b(\d{1,2})\.(\d{3})\.(\d{3})-([\dkK])\b")


def normalizar_rut(s: str) -> str:
    return re.sub(r"[.\s]", "", s).upper()


def calcular_iva(monto: int, tipo: str) -> int:
    return round(monto * 19 / 119) if tipo == "F" else 0


def clasificar(desc: str, rut: str | None = None) -> tuple[str, str, str, int]:
    """
    Returns (cuenta, cc, tipo_doc, confianza 0-100).
    confianza: 100 = maestro RUT, 85 = regla keyword, 50/30 = prior RUT, 0 = sin clasificar
    """
    # 1. Maestro por RUT
    if rut:
        rut_norm = normalizar_rut(rut)
        if rut_norm in DIRECT_RUTS:
            cuenta, tipo = DIRECT_RUTS[rut_norm]
            _, cc = PLAN[cuenta]
            return cuenta, cc, tipo, 100
        # Prior por RUT
        try:
            base = rut_norm.split("-")[0]
            rut_num = int(re.sub(r"[^0-9]", "", base))
        except Exception:
            rut_num = 0
        if rut_num < 50_000_000:
            return "1.2.1", "CC2", "S", 50   # probable sueldo/honorario
        else:
            return "1.3.6", "CC3", "F", 30   # probable proveedor empresa

    # 2. Reglas por descripción
    d = _strip(desc.upper())
    for keywords, cuenta, tipo in REGLAS:
        if any(k in d for k in keywords):
            _, cc = PLAN[cuenta]
            return cuenta, cc, tipo, 85

    return "", "", "S", 0

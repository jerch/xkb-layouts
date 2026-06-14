import xml.etree.ElementTree as ET
from json import dumps
import sys

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


tree = ET.parse('/usr/share/X11/xkb/rules/xorg.xml')
root = tree.getroot()
layouts = root.find('layoutList')


def extract_config_data(el):
    names = [e.text for e in el.iterfind('name')]
    descriptions = [e.text for e in el.iterfind('description')]
    if len(names) != 1 or len(descriptions) != 1:
        raise Exception('multiple names or descriptions returned')
    name = names[0]
    description = descriptions[0]
    result = {'desc': description}
    countries = [e.text for e in el.iterfind('countryList/iso3166Id')]
    if countries:
        result['countries'] = countries
    langs = [e.text for e in el.iterfind('languageList/iso639Id')]
    if langs:
        result['langs'] = langs
    return [name, result]


def extract_structured():
    if layouts is not None:
        result = {}
        for el in layouts.iterfind('layout'):
            configItems = el.findall('configItem')
            if len(configItems) != 1:
                raise Exception('multiple config items found')
            layout_name, layout_data = extract_config_data(configItems[0])
            variants = {}
            for e in el.iterfind('variantList/variant/configItem'):
                variant_name, variant_data = extract_config_data(e)
                if variant_name in variants:
                    raise Exception('variant already registered')
                variants[variant_name] = variant_data
            if variants:
                layout_data['variants'] = variants
            if layout_name in result:
                raise Exception('layout already registered')
            result[layout_name] = layout_data
    print(dumps(result, indent=2))

extract_structured()

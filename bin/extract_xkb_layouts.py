import xml.etree.ElementTree as ET
from json import dumps
import sys

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


tree = ET.parse('/usr/share/X11/xkb/rules/xorg.xml')
root = tree.getroot()
layouts = root.find('layoutList')

if layouts is not None:
    result = []
    for el in layouts.iterfind('layout'):
        # get base layout
        names = [e.text for e in el.findall('configItem/name')]
        description = [e.text for e in el.findall('configItem/description')]
        if len(names) != 1:
            raise Exception('names is faulty')
        if len(description) != 1:
            raise Exception('description is faulty')
        name = names[0]
        description = description[0]
        result.append({'name': name, 'desc': description})

        # get variants
        variants = [e.text for e in el.findall('variantList/variant/configItem/name')]
        descriptions = [e.text for e in el.findall('variantList/variant/configItem/description')]
        if len(variants) != len(descriptions):
            raise Exception('issue with variants')
        for variant, desc in zip(variants, descriptions):
            result.append({'name': f'{name} {variant}', 'desc': desc})
    print(dumps(result, indent=2))
    eprint(f'{len(result)} layouts exported')

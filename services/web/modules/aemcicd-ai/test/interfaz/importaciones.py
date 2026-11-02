"""Archivos sintéticos para probar los importadores nativos, sin datos personales."""
from pathlib import Path
from zipfile import ZipFile

salida = Path('/tmp/aemcicd-ia-importaciones')
salida.mkdir(exist_ok=True)
with ZipFile(salida / 'prism.zip', 'w') as archivo:
    archivo.writestr('main.tex', r'\documentclass{article}\begin{document}Proyecto importado.\end{document}')
    archivo.writestr('datos/mediciones.csv', 'x,y\n0,1\n1,3\n2,5\n')
with ZipFile(salida / 'word.docx', 'w') as archivo:
    archivo.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    archivo.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    archivo.writestr('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Informe sintético de laboratorio. La revisión final corresponde a sus autores.</w:t></w:r></w:p></w:body></w:document>')
print(salida)

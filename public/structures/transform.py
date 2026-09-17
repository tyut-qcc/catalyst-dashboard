#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cif2xyz.py —— 将 CIF 文件转换为 XYZ 格式。

默认行为:
    不带参数运行时，递归扫描当前目录及所有子目录，转换其中所有 .cif 文件，
    并在每个 CIF 文件所在目录生成同名 .xyz 文件。

也可指定单个文件或目录:
    python cif2xyz.py input.cif                # 转换单个文件
    python cif2xyz.py input.cif -o out.xyz     # 指定输出文件
    python cif2xyz.py /path/to/cif_folder      # 递归转换该目录下所有 .cif

其他选项:
    --no-symmetry   不应用对称操作，仅输出不对称单元中的原子
    --cell          在 XYZ 第二行附加晶胞参数
    --index N       选择 CIF 中的第 N 个数据块（默认 0）
    --delete-cif    转换成功后删除对应的 CIF 文件（危险操作，请谨慎使用）
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from pathlib import Path

# --------------------------------------------------------------------------- #
# 元素表（用于从标签推断元素符号）
# --------------------------------------------------------------------------- #
ELEMENTS = {
    "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
    "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
    "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
    "Ga", "Ge", "As", "Se", "Br", "Kr",
    "Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd",
    "In", "Sn", "Sb", "Te", "I", "Xe",
    "Cs", "Ba", "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy",
    "Ho", "Er", "Tm", "Yb", "Lu",
    "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg", "Tl", "Pb", "Bi",
    "Po", "At", "Rn",
    "Fr", "Ra", "Ac", "Th", "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf",
    "Es", "Fm", "Md", "No", "Lr",
    "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn", "Nh", "Fl", "Mc",
    "Lv", "Ts", "Og",
}

RESERVED = {"loop_", "stop_", "global_"}


# --------------------------------------------------------------------------- #
# CIF 词法分析
# --------------------------------------------------------------------------- #
def tokenize(text: str) -> list[str]:
    """把 CIF 文本拆成 token 列表（去掉注释、空白）。"""
    tokens: list[str] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
            continue
        if c == "#":
            j = text.find("\n", i)
            i = n if j == -1 else j + 1
            continue
        if c in ("'", '"'):
            j = text.find(c, i + 1)
            if j == -1:
                tokens.append(text[i + 1:])
                break
            tokens.append(text[i + 1:j])
            i = j + 1
            continue
        j = i
        while j < n and not text[j].isspace() and text[j] != "#":
            j += 1
        tokens.append(text[i:j])
        i = j
    return tokens


# --------------------------------------------------------------------------- #
# CIF 语法分析
# --------------------------------------------------------------------------- #
def parse_cif(text: str) -> list[dict]:
    """解析 CIF, 返回数据块列表。"""
    tokens = tokenize(text)
    blocks: list[dict] = []
    cur = {"name": "", "items": {}, "loops": []}
    i, n = 0, len(tokens)

    while i < n:
        t = tokens[i]
        tl = t.lower()

        if tl.startswith("data_"):
            if cur["items"] or cur["loops"] or cur["name"]:
                blocks.append(cur)
            cur = {"name": t[5:], "items": {}, "loops": []}
            i += 1

        elif tl == "loop_":
            i += 1
            tags: list[str] = []
            while i < n and tokens[i].startswith("_"):
                tags.append(tokens[i].lower())
                i += 1
            values: list[str] = []
            while i < n:
                tk = tokens[i]
                tkl = tk.lower()
                if tk.startswith("_") or tkl in RESERVED or tkl.startswith("data_"):
                    break
                values.append(tk)
                i += 1
            ncol = len(tags)
            rows: list[dict] = []
            if ncol:
                for r in range(0, len(values) - ncol + 1, ncol):
                    rows.append(dict(zip(tags, values[r:r + ncol])))
            cur["loops"].append({"tags": tags, "rows": rows})

        elif t.startswith("_"):
            key = tl
            i += 1
            if i < n:
                nxt = tokens[i]
                nl = nxt.lower()
                if (not nxt.startswith("_")) and nl not in RESERVED \
                        and not nl.startswith("data_"):
                    cur["items"][key] = nxt
                    i += 1
                else:
                    cur["items"][key] = None
            else:
                cur["items"][key] = None

        else:
            i += 1

    if cur["items"] or cur["loops"] or cur["name"]:
        blocks.append(cur)
    return blocks


# --------------------------------------------------------------------------- #
# 工具函数
# --------------------------------------------------------------------------- #
def to_float(s) -> float | None:
    """把 CIF 数值字符串转成 float, 自动去掉标准偏差括号。"""
    if s is None:
        return None
    s = re.sub(r"\(.*?\)", "", str(s)).strip()
    try:
        return float(s)
    except ValueError:
        return None


def pick(tags: list[str], *names: str) -> str | None:
    """在标签列表中按精确匹配、再按前缀匹配查找。"""
    low = [t.lower() for t in tags]
    for name in names:
        for idx, t in enumerate(low):
            if t == name:
                return tags[idx]
    for name in names:
        for idx, t in enumerate(low):
            if t.startswith(name):
                return tags[idx]
    return None


def guess_element(s: str | None) -> str | None:
    """从原子标签或类型符号中猜测元素符号。"""
    if not s:
        return None
    letters = re.sub(r"[^A-Za-z]", "", s)
    if not letters:
        return None
    two = letters[:2].capitalize()
    if two in ELEMENTS:
        return two
    one = letters[:1].upper()
    if one in ELEMENTS:
        return one
    return two


# --------------------------------------------------------------------------- #
# 晶胞参数 -> 笛卡尔矩阵
# --------------------------------------------------------------------------- #
def cell_matrix(a: float, b: float, c: float,
                alpha: float, beta: float, gamma: float) -> list[tuple]:
    """返回 3x3 矩阵（行向量为 a、b、c 轴）。"""
    ar, br, gr = math.radians(alpha), math.radians(beta), math.radians(gamma)
    ca, cb, cg = math.cos(ar), math.cos(br), math.cos(gr)
    sg = math.sin(gr)
    if abs(sg) < 1e-12:
        sg = 1e-12

    avec = (a, 0.0, 0.0)
    bvec = (b * cg, b * sg, 0.0)

    cx = c * cb
    cy = c * (ca - cb * cg) / sg
    cz = math.sqrt(max(c * c - cx * cx - cy * cy, 0.0))
    cvec = (cx, cy, cz)

    return [avec, bvec, cvec]


def frac_to_cart(frac, M) -> tuple[float, float, float]:
    """分数坐标 -> 笛卡尔坐标。"""
    fx, fy, fz = frac
    x = fx * M[0][0] + fy * M[1][0] + fz * M[2][0]
    y = fx * M[0][1] + fy * M[1][1] + fz * M[2][1]
    z = fx * M[0][2] + fy * M[1][2] + fz * M[2][2]
    return x, y, z


# --------------------------------------------------------------------------- #
# 对称操作
# --------------------------------------------------------------------------- #
def eval_component(expr: str, x: float, y: float, z: float) -> float:
    """计算对称操作的一个分量, 例如 '1/2+x'、'-y'、'2x-z'。"""
    e = expr.strip().lower().replace(" ", "")
    e = re.sub(r"(\d+)/(\d+)", r"(\1/\2)", e)
    e = re.sub(r"(\d|\))([xyz])", r"\1*\2", e)
    return float(eval(e, {"__builtins__": {}}, {"x": x, "y": y, "z": z}))  # noqa: S307


def get_symops(block: dict) -> list[str]:
    """收集 CIF 中的对称操作字符串。"""
    sym_tags = (
        "_symmetry_equiv_pos_as_xyz",
        "_space_group_symop_operation_xyz",
        "_symmetry_equiv_pos_as_xyz_",
    )
    ops: list[str] = []

    for loop in block["loops"]:
        low = [t.lower() for t in loop["tags"]]
        for st in sym_tags:
            if st in low:
                key = loop["tags"][low.index(st)]
                for row in loop["rows"]:
                    v = row.get(key)
                    if v:
                        ops.append(v)
                break

    for k, v in block["items"].items():
        if k.lower() in sym_tags and v:
            ops.append(v)

    return ops


def expand_symmetry(fx, fy, fz, symops) -> list[tuple[float, float, float]]:
    """对一个分数坐标应用所有对称操作, 去重并取模到 [0,1)。"""
    seen = set()
    out: list[tuple[float, float, float]] = []
    for op in symops:
        parts = op.split(",")
        if len(parts) != 3:
            continue
        try:
            nx = eval_component(parts[0], fx, fy, fz) % 1.0
            ny = eval_component(parts[1], fx, fy, fz) % 1.0
            nz = eval_component(parts[2], fx, fy, fz) % 1.0
        except Exception:
            continue
        key = (round(nx, 6), round(ny, 6), round(nz, 6))
        if key in seen:
            continue
        seen.add(key)
        out.append((nx, ny, nz))
    return out


# --------------------------------------------------------------------------- #
# 从数据块中提取结构
# --------------------------------------------------------------------------- #
def find_atom_loop(block: dict) -> dict | None:
    for loop in block["loops"]:
        low = [t.lower() for t in loop["tags"]]
        if any(t.startswith("_atom_site_fract_") or t.startswith("_atom_site_cartn_")
               for t in low):
            return loop
    return None


def extract_atoms(block: dict, use_symmetry: bool = True):
    """返回 (atoms, cell_params)。"""
    items = block["items"]

    a = to_float(items.get("_cell_length_a"))
    b = to_float(items.get("_cell_length_b"))
    c = to_float(items.get("_cell_length_c"))
    al = to_float(items.get("_cell_angle_alpha"))
    be = to_float(items.get("_cell_angle_beta"))
    ga = to_float(items.get("_cell_angle_gamma"))
    cell = None
    M = None
    if None not in (a, b, c, al, be, ga):
        cell = {"a": a, "b": b, "c": c, "alpha": al, "beta": be, "gamma": ga}
        M = cell_matrix(a, b, c, al, be, ga)

    loop = find_atom_loop(block)
    if loop is None:
        return [], cell

    tags = loop["tags"]
    kx = pick(tags, "_atom_site_fract_x")
    ky = pick(tags, "_atom_site_fract_y")
    kz = pick(tags, "_atom_site_fract_z")
    is_frac = True
    if not (kx and ky and kz):
        kx = pick(tags, "_atom_site_cartn_x")
        ky = pick(tags, "_atom_site_cartn_y")
        kz = pick(tags, "_atom_site_cartn_z")
        is_frac = False
    if not (kx and ky and kz):
        return [], cell

    ktype = pick(tags, "_atom_site_type_symbol")
    klabel = pick(tags, "_atom_site_label")
    kocc = pick(tags, "_atom_site_occupancy")

    symops = get_symops(block) if use_symmetry else []
    if not symops:
        symops = ["x,y,z"]

    atoms: list[tuple[str, float, float, float]] = []

    for row in loop["rows"]:
        occ = to_float(row.get(kocc)) if kocc else None
        if occ is not None and occ <= 1e-9:
            continue

        fx = to_float(row.get(kx))
        fy = to_float(row.get(ky))
        fz = to_float(row.get(kz))
        if None in (fx, fy, fz):
            continue

        el = guess_element(row.get(ktype) if ktype else None) \
            or guess_element(row.get(klabel) if klabel else None)
        if el is None:
            el = "X"

        if not is_frac:
            atoms.append((el, fx, fy, fz))
            continue

        if M is None:
            raise ValueError("CIF 缺少晶胞参数, 无法把分数坐标转换为笛卡尔坐标。")

        if use_symmetry and symops:
            coords = expand_symmetry(fx, fy, fz, symops)
        else:
            coords = [(fx % 1.0, fy % 1.0, fz % 1.0)]

        for f in coords:
            x, y, z = frac_to_cart(f, M)
            atoms.append((el, x, y, z))

    return atoms, cell


# --------------------------------------------------------------------------- #
# 写 XYZ
# --------------------------------------------------------------------------- #
def write_xyz(atoms, cell, out_path: Path, comment: str = "") -> None:
    lines = [str(len(atoms))]
    if cell:
        cell_str = (f"a={cell['a']:.6f} b={cell['b']:.6f} c={cell['c']:.6f} "
                    f"alpha={cell['alpha']:.4f} beta={cell['beta']:.4f} "
                    f"gamma={cell['gamma']:.4f}")
        lines.append(f"{comment} {cell_str}".strip())
    else:
        lines.append(comment or "generated by cif2xyz.py")

    for el, x, y, z in atoms:
        lines.append(f"{el:<2s} {x:>14.8f} {y:>14.8f} {z:>14.8f}")

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------- #
# 单文件转换
# --------------------------------------------------------------------------- #
def convert(cif_path: Path, xyz_path: Path, use_symmetry: bool = True,
            include_cell: bool = False, block_index: int = 0) -> int:
    text = cif_path.read_text(encoding="utf-8", errors="ignore")
    blocks = parse_cif(text)
    if not blocks:
        raise ValueError(f"{cif_path}: 未解析到任何 CIF 数据块")

    if block_index >= len(blocks):
        raise ValueError(f"{cif_path}: 数据块索引 {block_index} 超出范围 "
                         f"(共 {len(blocks)} 个)")

    block = blocks[block_index]
    atoms, cell = extract_atoms(block, use_symmetry=use_symmetry)

    if not atoms:
        raise ValueError(f"{cif_path}: 未找到原子位点信息")

    comment = f"CIF: {cif_path.name}"
    if block.get("name"):
        comment += f" | data_{block['name']}"

    write_xyz(atoms, cell if include_cell else None, xyz_path, comment)
    return len(atoms)


# --------------------------------------------------------------------------- #
# 主程序
# --------------------------------------------------------------------------- #
def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="将 CIF 文件转换为 XYZ 格式（支持目录递归与删除源文件）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "input", nargs="?", default=".",
        help="输入 CIF 文件或目录（默认当前目录，递归查找所有 .cif）"
    )
    parser.add_argument(
        "-o", "--output",
        help="输出 XYZ 文件（仅当输入为单个文件时有效）"
    )
    parser.add_argument(
        "--no-symmetry", action="store_true",
        help="不应用对称操作，仅输出文件中列出的原子"
    )
    parser.add_argument(
        "--cell", action="store_true",
        help="在 XYZ 第二行附加晶胞参数信息"
    )
    parser.add_argument(
        "--index", type=int, default=0,
        help="要转换的数据块编号（默认 0，即第一个）"
    )
    parser.add_argument(
        "--delete-cif", action="store_true",
        help="转换成功后删除对应的 CIF 文件（危险操作，请谨慎使用）"
    )
    args = parser.parse_args(argv)

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"错误: 路径不存在 {input_path}", file=sys.stderr)
        return 1

    # 收集所有待转换的 CIF 文件
    cif_files: list[Path] = []
    if input_path.is_file():
        if input_path.suffix.lower() != ".cif":
            print(f"警告: {input_path} 不是 .cif 文件，仍尝试转换。")
        cif_files.append(input_path)
    elif input_path.is_dir():
        for p in input_path.rglob("*"):
            if p.is_file() and p.suffix.lower() == ".cif":
                cif_files.append(p)
        if not cif_files:
            print(f"在 {input_path} 及其子目录中未找到 .cif 文件。")
            return 0
    else:
        print(f"错误: {input_path} 既不是文件也不是目录。", file=sys.stderr)
        return 1

    # 单文件且指定了 -o 时，使用指定输出路径
    if len(cif_files) == 1 and args.output:
        xyz_path = Path(args.output)
        try:
            n = convert(
                cif_files[0], xyz_path,
                use_symmetry=not args.no_symmetry,
                include_cell=args.cell,
                block_index=args.index,
            )
            print(f"已转换 {n} 个原子 -> {xyz_path}")
            if args.delete_cif:
                try:
                    cif_files[0].unlink()
                    print(f"已删除 {cif_files[0]}")
                except OSError as exc:
                    print(f"警告: 删除 {cif_files[0]} 失败: {exc}", file=sys.stderr)
        except Exception as exc:
            print(f"错误: 转换 {cif_files[0]} 失败: {exc}", file=sys.stderr)
            return 1
        return 0

    # 批量转换
    success = 0
    failed = 0
    deleted = 0
    for cif_path in cif_files:
        xyz_path = cif_path.with_suffix(".xyz")
        try:
            n = convert(
                cif_path, xyz_path,
                use_symmetry=not args.no_symmetry,
                include_cell=args.cell,
                block_index=args.index,
            )
            print(f"已转换 {cif_path} -> {xyz_path} ({n} 个原子)")
            success += 1

            if args.delete_cif:
                try:
                    cif_path.unlink()
                    print(f"  已删除 {cif_path}")
                    deleted += 1
                except OSError as exc:
                    print(f"  警告: 删除 {cif_path} 失败: {exc}", file=sys.stderr)
        except Exception as exc:
            print(f"错误: 转换 {cif_path} 失败: {exc}", file=sys.stderr)
            failed += 1

    print(f"\n完成: 成功 {success} 个, 失败 {failed} 个。")
    if args.delete_cif:
        print(f"已删除 {deleted} 个 CIF 文件。")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
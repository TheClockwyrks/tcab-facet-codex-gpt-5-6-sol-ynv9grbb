#!/usr/bin/env bash
# One-time production script. Generated outputs are committed; npm build never runs this.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/assets/{gems,fx,audio} .asset-work

colors=("#e53b68" "#ff8a32" "#f5cf42" "#42c77a" "#38d2c8" "#4b7fea" "#a95de5")
kinds=(ruby amber citrine jade beryl sapphire amethyst)
dark=("#6f1737" "#7f3a16" "#75621b" "#176139" "#176766" "#223b7b" "#51277a")

gem() {
  local name=$1 color=$2 shade=$3 strain=$4 cfg=.asset-work/draw.json log=.asset-work/draw-actions.json
  cat > "$cfg" <<EOF
{"width":64,"height":64,"background":"transparent","actions":"$PWD/$log","preview":"$PWD/public/assets/gems/$name.png","layers":"$PWD/.asset-work/layers.json"}
EOF
  draw --config "$cfg" init >/dev/null
  # layered, lit cabochon with a strong silhouette and facet web
  draw --config "$cfg" fill-circle --cx 32 --cy 33 --r $((27-strain)) --color "$shade" >/dev/null
  draw --config "$cfg" fill-circle --cx 32 --cy 30 --r $((23-strain)) --color "$color" >/dev/null
  draw --config "$cfg" fill-circle --cx 25 --cy 22 --r 7 --color "#ffffff88" >/dev/null
  draw --config "$cfg" line --x0 9 --y0 32 --x1 32 --y1 7 --color "#ffffff99" >/dev/null
  draw --config "$cfg" line --x0 55 --y0 32 --x1 32 --y1 7 --color "#ffffff55" >/dev/null
  draw --config "$cfg" line --x0 9 --y0 32 --x1 32 --y1 56 --color "#00000066" >/dev/null
  draw --config "$cfg" line --x0 55 --y0 32 --x1 32 --y1 56 --color "#00000066" >/dev/null
  draw --config "$cfg" line --x0 9 --y0 32 --x1 55 --y1 32 --color "#ffffff55" >/dev/null
  if (( strain >= 1 )); then draw --config "$cfg" line --x0 31 --y0 8 --x1 28 --y1 29 --color "#240e2d" >/dev/null; fi
  if (( strain >= 2 )); then draw --config "$cfg" line --x0 28 --y0 29 --x1 15 --y1 39 --color "#240e2d" >/dev/null; draw --config "$cfg" line --x0 28 --y0 29 --x1 42 --y1 43 --color "#240e2d" >/dev/null; fi
  if (( strain >= 3 )); then draw --config "$cfg" line --x0 42 --y0 43 --x1 48 --y1 51 --color "#fff0f0" >/dev/null; draw --config "$cfg" line --x0 28 --y0 29 --x1 48 --y1 20 --color "#fff0f0" >/dev/null; draw --config "$cfg" stroke-circle --cx 32 --cy 32 --r 29 --color "#ffedf2" >/dev/null; fi
  draw --config "$cfg" render --actions "$log" --out "public/assets/gems/$name.png" --width 64 --height 64 >/dev/null
}

for i in "${!kinds[@]}"; do
  for s in 0 1 2 3; do gem "${kinds[$i]}-$s" "${colors[$i]}" "${dark[$i]}" "$s"; done
done
for s in 0 1 2 3; do gem "prism-$s" "#dffcff" "#786ee8" "$s"; done

# Cut overlays and a jeweller's board surround.
for cut in brilliant star; do
  cfg=.asset-work/draw.json; log=.asset-work/draw-actions.json
  cat > "$cfg" <<EOF
{"width":64,"height":64,"background":"transparent","actions":"$PWD/$log","preview":"$PWD/public/assets/gems/$cut.png","layers":"$PWD/.asset-work/layers.json"}
EOF
  draw --config "$cfg" init >/dev/null
  if [[ $cut == brilliant ]]; then
    draw --config "$cfg" stroke-circle --cx 32 --cy 32 --r 25 --color '#fff5ad' >/dev/null
    for p in '32 5 32 59' '5 32 59 32' '13 13 51 51' '51 13 13 51'; do set -- $p; draw --config "$cfg" line --x0 $1 --y0 $2 --x1 $3 --y1 $4 --color '#ffffffcc' >/dev/null; done
  else
    for p in '32 5 32 59' '5 32 59 32' '13 13 51 51' '51 13 13 51'; do set -- $p; draw --config "$cfg" line --x0 $1 --y0 $2 --x1 $3 --y1 $4 --color '#fff2a8ee' >/dev/null; done
    draw --config "$cfg" fill-circle --cx 32 --cy 32 --r 5 --color '#ffffffee' >/dev/null
  fi
  draw --config "$cfg" render --actions "$log" --out "public/assets/gems/$cut.png" --width 64 --height 64 >/dev/null
done

cfg=.asset-work/frame.json; log=.asset-work/frame-actions.json
cat > "$cfg" <<EOF
{"width":640,"height":640,"background":"transparent","actions":"$PWD/$log","preview":"$PWD/public/assets/gems/board-frame.png","layers":"$PWD/.asset-work/layers.json"}
EOF
draw --config "$cfg" init >/dev/null
draw --config "$cfg" fill-rect --x 10 --y 10 --width 620 --height 620 --color '#0b1426ee' >/dev/null
draw --config "$cfg" stroke-rect --x 10 --y 10 --width 620 --height 620 --color '#80e4ffaa' >/dev/null
draw --config "$cfg" stroke-rect --x 20 --y 20 --width 600 --height 600 --color '#30496faa' >/dev/null
draw --config "$cfg" render --actions "$log" --out public/assets/gems/board-frame.png --width 640 --height 640 >/dev/null

# Frame-by-frame break animations and prism idle turn.
for kind_i in "${!kinds[@]}"; do
  kind=${kinds[$kind_i]}; mkdir -p "public/assets/gems/break/$kind"
  cfg=.asset-work/sheet.json
  cat > "$cfg" <<EOF
{"width":64,"height":64,"background":"transparent","frames":[0,1,2,3,4],"actions":"$PWD/.asset-work/${kind}-{frame}.json","preview":"$PWD/public/assets/gems/break/$kind/{frame}.png","layers":"$PWD/.asset-work/layers.json"}
EOF
  draw-sheet --config "$cfg" init >/dev/null
  for f in 0 1 2 3 4; do
    r=$((24-f*4)); ((r<4)) && r=4; off=$((f*5));
    draw-sheet --config "$cfg" --frame "$f" fill-circle --cx $((32-off/2)) --cy $((31-off/3)) --r "$r" --color "${colors[$kind_i]}" >/dev/null
    draw-sheet --config "$cfg" --frame "$f" fill-circle --cx $((43+off/2)) --cy $((35+off/4)) --r $((r/2)) --color "${dark[$kind_i]}" >/dev/null
    draw-sheet --config "$cfg" --frame "$f" line --x0 $((18-off/2)) --y0 $((20-off/3)) --x1 $((48+off/2)) --y1 $((46+off/4)) --color '#ffffffbb' >/dev/null
  done
  for f in 0 1 2 3 4; do draw-sheet --config "$cfg" render --actions ".asset-work/${kind}-$f.json" --out "public/assets/gems/break/$kind/$f.png" --width 64 --height 64 >/dev/null; done
done
mkdir -p public/assets/gems/prism-turn
for f in 0 1 2 3 4 5; do cp "public/assets/gems/prism-$((f%4)).png" "public/assets/gems/prism-turn/$f.png"; done

# Particle systems.
for fx in clear-burst flawed-detonation cut-flash cut-aura; do
  mkdir -p "public/assets/fx/$fx"; cfg=.asset-work/particle.json
  loop=false; burst=16; rate=0; life=420; speed=85; [[ $fx == flawed-detonation ]] && burst=32 && speed=150 && life=600; [[ $fx == cut-flash ]] && burst=22 && speed=65; [[ $fx == cut-aura ]] && burst=0 && rate=8 && life=800 && speed=20 && loop=true
  cat > "$cfg" <<EOF
{"width":160,"height":160,"duration_ms":1200,"fps":30,"seed":47,"actions":"$PWD/.asset-work/particle-actions.json","preview":"$PWD/.asset-work/$fx.gif","system":"$PWD/public/assets/fx/$fx/system.json"}
EOF
  particle-2d --config "$cfg" init >/dev/null
  if (( rate > 0 )); then emit=(--rate "$rate"); else emit=(--burst "$burst"); fi
  particle-2d --config "$cfg" add-emitter --name sparks --shape point --x 80 --y 80 "${emit[@]}" --lifetime "$life" --lifetime-spread 120 --speed "$speed" --speed-spread 35 --dir-y 1 --cone-angle 180 --seed 47 >/dev/null
  particle-2d --config "$cfg" set-particle --emitter sparks --size-curve ease-out --size-from 7 --size-to 1 --opacity-curve ease-in --opacity-from 1 --opacity-to 0 --color-gradient '#fffbd2@0,#67e9ff@0.45,#9d5cff@1' --rotation 220 --stretch 0.8 >/dev/null
  particle-2d --config "$cfg" set-timeline --loop "$loop" >/dev/null
  particle-2d --config "$cfg" render >/dev/null
done

# Distinct synthesized cues and an eight-rung chain ladder.
declare -A freq=( [select]=620 [swap]=420 [refuse]=110 [land]=150 [flaw]=210 [cut]=940 [levelup]=520 [gameover]=330 )
for cue in select swap refuse land flaw cut levelup gameover; do
  cfg=.asset-work/sfx.json
  cat > "$cfg" <<EOF
{"sample_rate":44100,"channels":"stereo","max_duration_ms":1600,"seed":91,"actions":"$PWD/.asset-work/sfx-actions.json","preview":"$PWD/.asset-work/$cue.png","wav":"$PWD/public/assets/audio/$cue.wav"}
EOF
  sfx-synth --config "$cfg" init >/dev/null
  wave=triangle; [[ $cue == refuse || $cue == flaw || $cue == land ]] && wave=noise
  sfx-synth --config "$cfg" add-voice --name body --wave "$wave" --freq "${freq[$cue]}" --gain -8 --dur 280 >/dev/null
  sfx-synth --config "$cfg" set-envelope --voice body --env punch >/dev/null
  if [[ $wave != noise ]]; then sfx-synth --config "$cfg" set-pitch --voice body --slide-to $((freq[$cue]+180)) --over 240 >/dev/null; fi
  sfx-synth --config "$cfg" add-reverb --bus master --mix 0.18 >/dev/null
  sfx-synth --config "$cfg" render >/dev/null
done
for n in 1 2 3 4 5 6 7 8; do
  cfg=.asset-work/sfx.json; hz=$((300+n*75))
  cat > "$cfg" <<EOF
{"sample_rate":44100,"channels":"stereo","max_duration_ms":800,"seed":$n,"actions":"$PWD/.asset-work/sfx-actions.json","preview":"$PWD/.asset-work/chain$n.png","wav":"$PWD/public/assets/audio/chain-$n.wav"}
EOF
  sfx-synth --config "$cfg" init >/dev/null; sfx-synth --config "$cfg" add-voice --name gem --wave sine --freq "$hz" --gain -7 --dur 360 >/dev/null; sfx-synth --config "$cfg" set-envelope --voice gem --env pluck >/dev/null; sfx-synth --config "$cfg" render >/dev/null
done

# Sampled shatter body.
cfg=.asset-work/sample.json
cat > "$cfg" <<EOF
{"sample_rate":44100,"channels":"stereo","max_duration_ms":1200,"seed":31,"sample_pack":"combat-core","actions":"$PWD/.asset-work/sample-actions.json","preview":"$PWD/.asset-work/shatter.png","wav":"$PWD/public/assets/audio/shatter.wav"}
EOF
sfx-sample --config "$cfg" init >/dev/null; sfx-sample --config "$cfg" add-sample --name debris_glass --t 0 --gain -3 --fade-out 180 >/dev/null; sfx-sample --config "$cfg" add-sample --name snap_transient --t 5 --gain -6 >/dev/null; sfx-sample --config "$cfg" render >/dev/null

# Original looping title hook and restrained play bed.
for piece in title play; do
  cfg=.asset-work/music.json; bpm=108; [[ $piece == play ]] && bpm=82
  cat > "$cfg" <<EOF
{"sample_rate":44100,"channels":"stereo","max_duration_ms":30000,"seed":17,"instrument_bank":"gm-lite","actions":"$PWD/.asset-work/music-actions.json","preview":"$PWD/.asset-work/$piece.png","wav":"$PWD/public/assets/audio/$piece.wav","mid":"$PWD/public/assets/audio/$piece.mid"}
EOF
  music --config "$cfg" init >/dev/null; music --config "$cfg" set-tempo --bpm "$bpm" >/dev/null
  music --config "$cfg" define-track --name lead --instrument music_box >/dev/null; music --config "$cfg" define-track --name bass --instrument marimba >/dev/null
  pitches=(C5 E5 G5 B5 A5 G5 E5 D5); [[ $piece == play ]] && pitches=(C4 G4 E4 A4 F4 C5 G4 E4)
  for i in "${!pitches[@]}"; do music --config "$cfg" add-note --track lead --pitch "${pitches[$i]}" --t "$i" --dur 0.8 --velocity 78 >/dev/null; done
  for i in 0 2 4 6; do music --config "$cfg" add-note --track bass --pitch C3 --t "$i" --dur 1.7 --velocity 55 >/dev/null; done
  music --config "$cfg" set-track-fx --track lead --gain -5 --pan 0.15 --reverb 0.35 --env pluck >/dev/null; music --config "$cfg" render >/dev/null
done
rm -rf .asset-work

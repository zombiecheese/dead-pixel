// Dead Pixel sprite sheet importer for Unity (2021.3 and later, needs the 2D Sprite package, part of the 2D feature set).
//
// Put this file in any Editor folder. Then drop a Dead Pixel sheet (name.png and name.json side by side) anywhere in
// Assets: the PNG is set up for pixel art (point filter, no compression, no mipmaps, the JSON's pixels per unit),
// sliced into one sprite per frame (named as in the JSON, pivot from the JSON), and an animation clip is made for
// every tag (name_Tag.anim, looping, frame times from the frame durations, reverse and ping-pong respected).
// Re-exporting the sheet keeps each sprite's ID, so references in prefabs and animations survive.
#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

namespace DeadPixel.EditorTools
{
    public class DeadPixelSheetImporter : AssetPostprocessor
    {
        [System.Serializable] class Box { public int x, y, w, h; }
        [System.Serializable] class Frame { public string filename; public Box frame; public int duration = 100; public int index; }
        [System.Serializable] class Tag { public string name; public int from, to; public string direction; }
        [System.Serializable] class Pivot { public float x = 0.5f, y = 0f; }
        [System.Serializable] class Size { public int w, h; }
        [System.Serializable] class Meta { public string image; public Size size; public float pixelsPerUnit = 1; public Pivot pivot; public Tag[] frameTags; }
        [System.Serializable] class Sheet { public string generator; public Frame[] frames; public Meta meta; }

        static Sheet Load(string pngPath)
        {
            if (!pngPath.EndsWith(".png", System.StringComparison.OrdinalIgnoreCase)) return null;
            string json = Path.ChangeExtension(pngPath, ".json");
            if (!File.Exists(json)) return null;
            try
            {
                var s = JsonUtility.FromJson<Sheet>(File.ReadAllText(json));
                return s != null && s.generator == "Dead Pixel" && s.frames != null && s.frames.Length > 0 ? s : null;
            }
            catch { return null; }
        }

        void OnPreprocessTexture()
        {
            var sheet = Load(assetPath);
            if (sheet == null) return;
            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Sprite;
            ti.spriteImportMode = SpriteImportMode.Multiple;
            ti.filterMode = FilterMode.Point;
            ti.textureCompression = TextureImporterCompression.Uncompressed;
            ti.mipmapEnabled = false;
            ti.alphaIsTransparency = true;
            ti.npotScale = TextureImporterNPOTScale.None;
            ti.spritePixelsPerUnit = Mathf.Max(1, sheet.meta != null ? sheet.meta.pixelsPerUnit : 1);

            var factory = new SpriteDataProviderFactories();
            factory.Init();
            var provider = factory.GetSpriteEditorDataProviderFromObject(ti);
            provider.InitSpriteEditorDataProvider();
            var existing = provider.GetSpriteRects().ToDictionary(r => r.name, r => r.spriteID);

            int texH = sheet.meta != null && sheet.meta.size != null && sheet.meta.size.h > 0 ? sheet.meta.size.h : 0;
            if (texH == 0) foreach (var f in sheet.frames) texH = Mathf.Max(texH, f.frame.y + f.frame.h);
            var pivot = sheet.meta != null && sheet.meta.pivot != null ? new Vector2(sheet.meta.pivot.x, sheet.meta.pivot.y) : new Vector2(0.5f, 0);

            var rects = new List<SpriteRect>();
            foreach (var f in sheet.frames)
            {
                var r = new SpriteRect
                {
                    name = f.filename,
                    rect = new Rect(f.frame.x, texH - f.frame.y - f.frame.h, f.frame.w, f.frame.h), // sheet rows run down, Unity's up
                    alignment = SpriteAlignment.Custom,
                    pivot = pivot,
                    border = Vector4.zero,
                    spriteID = existing.TryGetValue(f.filename, out var id) ? id : GUID.Generate(),
                };
                rects.Add(r);
            }
            provider.SetSpriteRects(rects.ToArray());
            var names = provider.GetDataProvider<ISpriteNameFileIdDataProvider>();
            if (names != null) names.SetNameFileIdPairs(rects.Select(r => new SpriteNameFileIdPair(r.name, r.spriteID)).ToList());
            provider.Apply();
        }

        static void OnPostprocessAllAssets(string[] imported, string[] deleted, string[] moved, string[] movedFrom)
        {
            foreach (var path in imported)
            {
                var sheet = Load(path);
                if (sheet == null) continue;
                var sprites = AssetDatabase.LoadAllAssetRepresentationsAtPath(path).OfType<Sprite>().ToDictionary(s => s.name);
                if (sprites.Count == 0) continue;
                string dir = Path.GetDirectoryName(path).Replace('\\', '/');
                string baseName = Path.GetFileNameWithoutExtension(path);

                var tags = sheet.meta != null && sheet.meta.frameTags != null && sheet.meta.frameTags.Length > 0
                    ? sheet.meta.frameTags
                    : new[] { new Tag { name = "", from = 0, to = int.MaxValue, direction = "forward" } };
                foreach (var tag in tags)
                {
                    // the frames of this tag, in order, each document frame once
                    var seen = new HashSet<int>();
                    var frames = sheet.frames.Where(f => f.index >= tag.from && f.index <= tag.to && seen.Add(f.index)).OrderBy(f => f.index).ToList();
                    if (frames.Count == 0) continue;
                    if (tag.direction == "reverse") frames.Reverse();
                    else if (tag.direction == "pingpong" && frames.Count > 2) frames.AddRange(frames.Skip(1).Take(frames.Count - 2).Reverse().ToList());

                    var keys = new List<ObjectReferenceKeyframe>();
                    float t = 0;
                    foreach (var f in frames)
                    {
                        if (!sprites.TryGetValue(f.filename, out var sprite)) continue;
                        keys.Add(new ObjectReferenceKeyframe { time = t, value = sprite });
                        t += Mathf.Max(10, f.duration) / 1000f;
                    }
                    if (keys.Count == 0) continue;
                    keys.Add(new ObjectReferenceKeyframe { time = t, value = keys[keys.Count - 1].value }); // hold the last frame its full time

                    string clipPath = dir + "/" + baseName + (string.IsNullOrEmpty(tag.name) ? "" : "_" + Safe(tag.name)) + ".anim";
                    var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
                    bool create = clip == null;
                    if (create) clip = new AnimationClip();
                    clip.frameRate = 60;
                    var binding = EditorCurveBinding.PPtrCurve("", typeof(SpriteRenderer), "m_Sprite");
                    AnimationUtility.SetObjectReferenceCurve(clip, binding, keys.ToArray());
                    var settings = AnimationUtility.GetAnimationClipSettings(clip);
                    settings.loopTime = true;
                    AnimationUtility.SetAnimationClipSettings(clip, settings);
                    if (create) AssetDatabase.CreateAsset(clip, clipPath);
                    else EditorUtility.SetDirty(clip);
                }
            }
        }

        static string Safe(string s)
        {
            var chars = s.Trim().Select(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' ? c : '_').ToArray();
            return chars.Length > 0 ? new string(chars) : "Tag";
        }
    }
}
#endif
